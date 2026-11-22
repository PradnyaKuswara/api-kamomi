import { BadRequestError, NotFoundError } from '../../errors/app-error.js';
import { toPage, type PageRequest } from '../../lib/pagination.js';
import type { RoomRepository } from '../rooms/room.repository.js';
import { toRoomDtos } from '../rooms/room.service.js';
import type { SubscriptionPolicy } from '../subscriptions/subscription-policy.js';
import type { AuthUser } from '../users/authz.js';
import type { AccessGuard } from './access.js';
import type { PropertyRepository } from './property.repository.js';
import type { UserAccessRepository } from './user-access.repository.js';

const bad = (m: string) => new BadRequestError(m, m);

export class UserAccessService {
  constructor(
    private readonly repo: UserAccessRepository,
    private readonly rooms: RoomRepository,
    private readonly properties: PropertyRepository,
    private readonly access: AccessGuard,
    private readonly policy: SubscriptionPolicy,
  ) {}

  async list(propertyId: number, actor: AuthUser, req: PageRequest) {
    await this.access.property(actor, propertyId);
    const [members, total] = await Promise.all([this.repo.findMembers(propertyId, req), this.repo.countMembers(propertyId)]);

    const content = [];
    for (const { u, roleName } of members) {
      const assigned = await this.repo.findAssignedRooms(u.id, propertyId);
      const last = await this.repo.findLastActivity(u.id);
      content.push({
        userId: u.id, userName: u.name, userEmail: u.email,
        assignedRooms: await toRoomDtos(this.rooms, assigned),
        lastLoginAt: last?.loginAt ?? null, lastLogoutAt: last?.logoutAt ?? null,
        isOnline: !!last && last.activityType.toUpperCase() === 'LOGIN' && !last.logoutAt,
        roleName, isActive: u.isActive, propertyNames: await this.properties.namesByUserId(u.id), phoneNumber: u.phoneNumber,
      });
    }
    return toPage(content, total, req);
  }

  async assign(propertyId: number, actor: AuthUser, userId: number, roomIds: number[] | null | undefined) {
    const property = await this.access.property(actor, propertyId);
    const target = await this.repo.findUserWithRole(userId);
    if (!target) throw new NotFoundError(`Target user with ID ${userId} not found`);

    const perms = await this.policy.permissions(actor.id);
    // Dibaca sebelum transaksi: query di luar `tx` saat transaksi terbuka akan menunggu koneksi yang sama.
    const targetRooms = roomIds?.length ? await this.rooms.findActiveByIdsInProperty(roomIds, property.id) : [];
    await this.repo.transaction(async (tx) => {
      await tx.clearRoomAssignments(userId, property.id);
      if (!(await tx.isMember(property.id, userId))) {
        const n = await tx.countMembers(property.id);
        if (perms.maxStaff !== -1 && n >= perms.maxStaff) {
          throw bad(perms.maxStaff === 0
            ? 'Paket Free hanya mengizinkan 1 Akun Pemilik. Tingkatkan paket berlangganan Anda untuk menambahkan Staff.'
            : `Batas maksimal staff untuk paket Anda adalah ${perms.maxStaff} akun.`);
        }
        await tx.addMember(property.id, userId);
      }
      await tx.assignRooms(userId, targetRooms.map((r) => r.id), actor.id);
    });

    return {
      userId: target.u.id, userName: target.u.name, userEmail: target.u.email,
      assignedRooms: await toRoomDtos(this.rooms, targetRooms), roleName: target.roleName, isActive: target.u.isActive,
      propertyNames: await this.properties.namesByUserId(userId), phoneNumber: target.u.phoneNumber,
      lastLoginAt: null, lastLogoutAt: null, isOnline: null,
    };
  }

  async remove(propertyId: number, actor: AuthUser, userId: number) {
    const property = await this.access.property(actor, propertyId);
    await this.repo.transaction(async (tx) => {
      await tx.clearRoomAssignments(userId, property.id);
      await tx.removeMember(property.id, userId);
    });
  }
}
