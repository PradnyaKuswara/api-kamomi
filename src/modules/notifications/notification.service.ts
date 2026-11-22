import type { DbOrTx } from '../../db/client.js';
import { NotFoundError } from '../../errors/app-error.js';
import { NotificationRepository, type NotificationRow } from './notification.repository.js';

export const NotificationType = {
  NEW_COMPLAINT: 'NEW_COMPLAINT', COMPLAINT_UPDATED: 'COMPLAINT_UPDATED', QR_ACTIVITY: 'QR_ACTIVITY',
  RULE_VIOLATION: 'RULE_VIOLATION', SUBSCRIPTION: 'SUBSCRIPTION', SYSTEM: 'SYSTEM',
} as const;

export const toNotificationDto = ({ n, propertyName }: NotificationRow) => ({
  id: n.id, userId: n.userId, propertyId: n.propertyId, propertyName, title: n.title, message: n.message,
  type: n.type, referenceId: n.referenceId, isRead: n.isRead, createdAt: n.createdAt,
});

export class NotificationService {
  constructor(private readonly repo: NotificationRepository) {}

  /** Id user dari email JWT; 404 bila tidak ada. */
  async resolveUserId(email: string | undefined) {
    const id = email ? await this.repo.findUserIdByEmail(email) : undefined;
    if (id === undefined) throw new NotFoundError(`User tidak ditemukan: ${email}`);
    return id;
  }

  /** Simpan notifikasi (bisa di dalam transaksi pemanggil via `db`) dan kembalikan DTO-nya. */
  async create(db: DbOrTx | undefined, input: { userId: number; propertyId: number | null; title: string; message: string; type: string; referenceId: number | null }) {
    const repo = db ? new NotificationRepository(db) : this.repo;
    return toNotificationDto(await repo.insert({ ...input, isRead: false, createdAt: new Date() }));
  }

  async list(userId: number, page: number, size: number) {
    const [rows, total] = await Promise.all([this.repo.findPage(userId, page, size), this.repo.countAll(userId)]);
    return { rows: rows.map(toNotificationDto), total };
  }

  unreadCount(userId: number) { return this.repo.countUnread(userId); }

  async markRead(userId: number, id: number) {
    const row = await this.repo.findOwned(userId, id);
    if (!row) throw new NotFoundError(`Notifikasi tidak ditemukan: ${id}`);
    await this.repo.markRead(id);
    return toNotificationDto({ ...row, n: { ...row.n, isRead: true } });
  }

  markAllRead(userId: number) { return this.repo.markAllRead(userId); }

  async remove(userId: number, id: number) {
    if (!(await this.repo.findOwned(userId, id))) throw new NotFoundError(`Notifikasi tidak ditemukan: ${id}`);
    await this.repo.softDelete(id);
  }
}
