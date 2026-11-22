import { BadRequestError, ForbiddenError } from '../../errors/app-error.js';
import { encryptId } from '../../lib/hash-id.js';
import { toJsonText } from '../../lib/json-text.js';
import { toPage, type PageRequest } from '../../lib/pagination.js';
import type { AccessGuard } from '../properties/access.js';
import type { SubscriptionPolicy } from '../subscriptions/subscription-policy.js';
import type { AuthUser } from '../users/authz.js';
import type { QrDesign, Room, RoomRepository, RuleRow } from './room.repository.js';

export interface QrDesignInput {
  customTitle?: string | null; customInstruction?: string | null; showLogo?: boolean | null;
  cardColor?: string | null; template?: string | null; labelRoom?: string | null;
}
export interface RoomInput {
  roomNumber?: string | null; wifiSsid?: string | null; wifiPassword?: string | null;
  ruleIds?: number[] | null; assignedUserIds?: number[] | null; isActive?: boolean | null; qrDesign?: QrDesignInput | null;
}

export const ruleDto = (r: RuleRow) => ({
  id: r.id, propertyId: r.propertyId, title: r.title, description: r.description,
  category: r.category, sequence: r.sequence, isActive: r.isActive, createdAt: r.createdAt,
});

const qrDto = (q: QrDesign) => ({
  customTitle: q.customTitle, customInstruction: q.customInstruction, showLogo: q.showLogo,
  cardColor: q.cardColor, template: q.template, labelRoom: q.labelRoom,
});

/** Muat rules + qr design untuk sekumpulan room sekaligus (hindari N+1). */
export async function toRoomDtos(repo: RoomRepository, list: Room[]) {
  if (list.length === 0) return [];
  const ids = list.map((r) => r.id);
  const [ruleRows, qrRows] = await Promise.all([repo.findRulesByRoomIds(ids), repo.findQrByRoomIds(ids)]);
  return list.map((room) => {
    const q = qrRows.find((x) => x.roomId === room.id);
    return {
      id: room.id, propertyId: room.propertyId, roomNumber: room.roomNumber, wifiSsid: room.wifiSsid,
      wifiPassword: room.wifiPassword, code: encryptId(room.id),
      rules: ruleRows.filter((x) => x.roomId === room.id).map((x) => ruleDto(x.rule)),
      createdAt: room.createdAt, isActive: room.isActive,
      qrDesign: q ? qrDto(q) : null,
    };
  });
}

/** Snapshot untuk kolom old_data/new_data di room_logs (sama dengan RoomService.toJson di Java). */
async function snapshot(repo: RoomRepository, room: Room) {
  const [rr, q] = await Promise.all([repo.findAllRulesOfRoom(room.id), repo.findQrOfRoom(room.id)]);
  return {
    id: room.id, propertyId: room.propertyId, roomNumber: room.roomNumber, wifiSsid: room.wifiSsid,
    wifiPassword: room.wifiPassword, createdAt: room.createdAt?.toISOString() ?? null,
    updatedAt: room.updatedAt?.toISOString() ?? null, deletedAt: room.deletedAt?.toISOString() ?? null,
    isActive: room.isActive, ruleIds: rr.map((x) => x.rule.id),
    ruleNames: rr.filter((x) => !x.rule.deletedAt).map((x) => x.rule.title),
    ...(q && { qrDesign: qrDto(q) }),
  };
}

export class RoomService {
  constructor(
    private readonly repo: RoomRepository,
    private readonly access: AccessGuard,
    private readonly policy: SubscriptionPolicy,
  ) {}

  async list(propertyId: number, actor: AuthUser, req: PageRequest) {
    await this.access.property(actor, propertyId);
    const isAdmin = actor.roleName === 'ADMIN' || actor.roleName === 'SUPER_ADMIN';
    const page = await this.repo.findPage(propertyId, req);
    if (isAdmin) return toPage(await toRoomDtos(this.repo, page), await this.repo.countByProperty(propertyId), req);
    // USER: hanya room yang ditugaskan (Java memfilter setelah paging; totalElements = jumlah terfilter).
    const mine = new Set(await this.repo.assignedRoomIds(actor.id));
    const filtered = page.filter((r) => mine.has(r.id));
    return toPage(await toRoomDtos(this.repo, filtered), filtered.length, req);
  }

  async get(roomId: number, actor: AuthUser) {
    const room = await this.access.room(actor, roomId);
    return (await toRoomDtos(this.repo, [room]))[0]!;
  }

  async create(propertyId: number, input: RoomInput, actor: AuthUser) {
    if (actor.roleName !== 'ADMIN') throw new ForbiddenError('Only ADMIN users are allowed to create rooms');
    const property = await this.access.property(actor, propertyId);
    const perms = await this.policy.permissions(actor.id);

    return this.repo.transaction(async (tx) => {
      const n = await tx.countByProperty(property.id);
      if (perms.maxRooms !== -1 && n >= perms.maxRooms) {
        const m = `Batas maksimal kamar untuk paket Anda adalah ${perms.maxRooms} kamar. Silakan tingkatkan paket berlangganan Anda.`;
        throw new BadRequestError(m, m);
      }
      const now = new Date();
      const created = await tx.insertRoom({
        propertyId: property.id, roomNumber: input.roomNumber ?? null, wifiSsid: input.wifiSsid ?? null,
        wifiPassword: input.wifiPassword ?? null, isActive: input.isActive ?? true,
        createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id,
      });

      await tx.addRules(created.id, await tx.findValidRuleIds(property.id, input.ruleIds ?? []));

      await tx.assignUsers(created.id, [actor.id], actor.id, now);
      const extra = [...new Set(input.assignedUserIds ?? [])].filter((id) => id !== actor.id);
      // Hanya anggota properti yang sama yang boleh ditugaskan.
      if (extra.length) await tx.assignUsers(created.id, await tx.filterPropertyMembers(property.id, extra), actor.id, now);

      const q = input.qrDesign;
      await tx.insertQr({
        roomId: created.id, customTitle: q?.customTitle ?? 'Welcome',
        customInstruction: q?.customInstruction ?? 'Scan QR for Room & Wi-Fi Info', showLogo: q?.showLogo ?? true,
        cardColor: q?.cardColor ?? 'cyan', template: q?.template ?? 'modern', labelRoom: q?.labelRoom ?? 'NOMOR KAMAR',
        isActive: true, createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id,
      });
      await tx.insertLog(created.id, actor.id, 'CREATE', null, await snapshot(tx, created));
      return (await toRoomDtos(tx, [created]))[0]!;
    });
  }

  async update(roomId: number, input: RoomInput, actor: AuthUser) {
    const existing = await this.access.room(actor, roomId);
    return this.repo.transaction(async (tx) => {
      const oldData = await snapshot(tx, existing);
      const now = new Date();
      const room = await tx.updateRoom(roomId, {
        roomNumber: input.roomNumber ?? null, wifiSsid: input.wifiSsid ?? null, wifiPassword: input.wifiPassword ?? null,
        updatedAt: now, updatedBy: actor.id, ...(input.isActive != null && { isActive: input.isActive }),
      });

      if (input.ruleIds != null) await tx.replaceRules(roomId, await tx.findValidRuleIds(existing.propertyId, input.ruleIds));

      const qr = await tx.findQrOfRoom(roomId);
      const q = input.qrDesign;
      if (qr) {
        await tx.updateQr(qr.id, {
          ...(q?.customTitle != null && { customTitle: q.customTitle }),
          ...(q?.customInstruction != null && { customInstruction: q.customInstruction }),
          ...(q?.showLogo != null && { showLogo: q.showLogo }),
          ...(q?.cardColor != null && { cardColor: q.cardColor }),
          ...(q?.template != null && { template: q.template }),
          ...(q?.labelRoom != null && { labelRoom: q.labelRoom }),
          updatedAt: now, updatedBy: actor.id,
        });
      } else {
        await tx.insertQr({
          roomId, customTitle: q?.customTitle ?? 'Welcome', customInstruction: q?.customInstruction ?? 'Scan QR for Room & Wi-Fi Info',
          showLogo: q?.showLogo ?? true, cardColor: q?.cardColor ?? null, template: q?.template ?? null, labelRoom: q?.labelRoom ?? null,
          isActive: true, createdAt: now, createdBy: actor.id, updatedAt: now, updatedBy: actor.id,
        });
      }

      await tx.insertLog(roomId, actor.id, 'UPDATE', oldData, await snapshot(tx, room));
      return (await toRoomDtos(tx, [room]))[0]!;
    });
  }

  async remove(roomId: number, actor: AuthUser) {
    const room = await this.access.room(actor, roomId);
    await this.repo.transaction(async (tx) => {
      const oldData = await snapshot(tx, room);
      await tx.softDeleteRoom(roomId);
      await tx.insertLog(roomId, actor.id, 'DELETE', oldData, null);
    });
  }

  private async logDtos(by: { propertyId: number } | { roomId: number }) {
    return (await this.repo.findLogs(by)).map(({ log, room, by: user }) => ({
      id: log.id, roomId: log.roomId, roomNumber: room?.roomNumber ?? null, action: log.action,
      oldData: toJsonText(log.oldData), newData: toJsonText(log.newData), createdAt: log.createdAt,
      createdByEmail: user?.email ?? null, createdByName: user?.name ?? null,
    }));
  }

  async logsByProperty(propertyId: number, actor: AuthUser) {
    await this.access.property(actor, propertyId);
    return this.logDtos({ propertyId });
  }

  async logsByRoom(roomId: number, actor: AuthUser) {
    // Log room yang sudah dihapus tetap bisa dilihat (seperti Java), tetapi akses tetap diperiksa.
    await this.access.room(actor, roomId, { allowDeleted: true });
    return this.logDtos({ roomId });
  }
}
