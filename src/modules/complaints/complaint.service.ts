import type { FastifyInstance } from 'fastify';
import { BadRequestError, NotFoundError } from '../../errors/app-error.js';
import { decryptId } from '../../lib/hash-id.js';
import { toPage, type PageRequest } from '../../lib/pagination.js';
import { NotificationType } from '../notifications/notification.service.js';
import type { SubscriptionPolicy } from '../subscriptions/subscription-policy.js';
import type { ComplaintRepository, ComplaintRow } from './complaint.repository.js';

const toDto = ({ c, roomNumber, propertyName }: ComplaintRow) => ({
  id: c.id, roomId: c.roomId, roomNumber, propertyName, category: c.category, description: c.description,
  guestName: c.guestName, guestContact: c.guestContact, ipAddress: c.ipAddress, status: c.status,
  responseNote: c.responseNote, createdAt: c.createdAt, updatedAt: c.updatedAt,
});

const badReq = (m: string) => new BadRequestError(m, m);

export type UpdateStatusInput = { status?: string | null; responseNote?: string | null };
export type PublicComplaintInput = {
  roomCode?: string | null; category?: string | null; description?: string | null;
  guestName?: string | null; guestContact?: string | null;
};

export class ComplaintService {
  constructor(
    private readonly app: FastifyInstance,
    private readonly repo: ComplaintRepository,
    private readonly policy: SubscriptionPolicy,
  ) {}

  async list(propertyId: number, status: string | undefined, req: PageRequest) {
    const s = status?.trim().toUpperCase();
    const filter = s && s !== 'ALL' ? s : null;
    const [rows, total] = await Promise.all([
      this.repo.findPage(propertyId, filter, req),
      this.repo.countByProperty(propertyId, filter),
    ]);
    return toPage(rows.map(toDto), total, req);
  }

  private async getOrThrow(propertyId: number, id: number) {
    const row = await this.repo.findById(propertyId, id);
    if (!row) throw new NotFoundError('Keluhan tidak ditemukan');
    return row;
  }

  async updateStatus(propertyId: number, id: number, b: UpdateStatusInput) {
    if (!b.status || !b.status.trim()) throw badReq('Status keluhan wajib diisi');
    const row = await this.getOrThrow(propertyId, id);
    const c = await this.repo.updateStatus(id, b.status.trim().toUpperCase(), b.responseNote != null ? b.responseNote.trim() : undefined);
    return toDto({ ...row, c });
  }

  async remove(propertyId: number, id: number) {
    await this.getOrThrow(propertyId, id);
    await this.repo.softDelete(id);
  }

  async createPublic(b: PublicComplaintInput, ip: string, userAgent: string | null) {
    if (!b.roomCode?.trim()) throw badReq('Kode kamar wajib diisi');
    if (!b.category?.trim()) throw badReq('Kategori keluhan wajib dipilih');
    if (!b.description?.trim()) throw badReq('Detail keluhan wajib diisi');
    const roomId = decryptId(b.roomCode);
    if (roomId === null) throw badReq('Kode kamar tidak valid');

    const row = await this.repo.findActiveRoomWithProperty(roomId);
    if (!row) throw new NotFoundError('Kamar tidak ditemukan');
    if (row.room.isActive === false) throw badReq('Kamar sedang tidak aktif');
    if (await this.policy.isSuspended(row.property.userId)) throw badReq('Layanan properti ini sedang ditangguhkan');

    const now = new Date();
    const c = await this.repo.insert({
      roomId, category: b.category.trim(), description: b.description.trim(), guestName: b.guestName?.trim() ?? null,
      guestContact: b.guestContact?.trim() ?? null, ipAddress: ip, userAgent, status: 'PENDING', createdAt: now, updatedAt: now,
    });

    const notif = await this.app.notifications.create(undefined, {
      userId: row.property.userId, propertyId: row.property.id, type: NotificationType.NEW_COMPLAINT, referenceId: c.id,
      title: `Keluhan Baru - Kamar ${row.room.roomNumber}`,
      message: `${b.guestName ?? 'Tamu'} melaporkan keluhan: ${b.description}`,
    });
    this.app.sse.send(row.property.userId, notif);
    return toDto({ c, roomNumber: row.room.roomNumber, propertyName: row.property.name });
  }
}
