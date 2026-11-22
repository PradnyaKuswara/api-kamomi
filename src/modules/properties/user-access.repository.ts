import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { propertyUsers, roles, rooms, userActivities, userRooms, users } from '../../db/schema/index.js';
import { BaseRepository } from '../../lib/base-repository.js';
import type { PageRequest } from '../../lib/pagination.js';

export class UserAccessRepository extends BaseRepository {
  findMembers(propertyId: number, req: PageRequest) {
    return this.db.select({ u: users, roleName: roles.name }).from(propertyUsers)
      .innerJoin(users, eq(propertyUsers.userId, users.id)).leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(propertyUsers.propertyId, propertyId)).orderBy(propertyUsers.id)
      .limit(req.size).offset(req.page * req.size);
  }

  async countMembers(propertyId: number) {
    const [r] = await this.db.select({ total: count() }).from(propertyUsers).where(eq(propertyUsers.propertyId, propertyId));
    return r?.total ?? 0;
  }

  async findAssignedRooms(userId: number, propertyId: number) {
    const rows = await this.db.select({ room: rooms }).from(userRooms).innerJoin(rooms, eq(userRooms.roomId, rooms.id))
      .where(and(eq(userRooms.userId, userId), eq(rooms.propertyId, propertyId)));
    return rows.map((r) => r.room);
  }

  async findLastActivity(userId: number) {
    const [last] = await this.db.select().from(userActivities).where(eq(userActivities.userId, userId)).orderBy(desc(userActivities.id)).limit(1);
    return last;
  }

  async findUserWithRole(userId: number) {
    const [t] = await this.db.select({ u: users, roleName: roles.name }).from(users).leftJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, userId)).limit(1);
    return t;
  }

  async isMember(propertyId: number, userId: number) {
    const [m] = await this.db.select({ id: propertyUsers.id }).from(propertyUsers)
      .where(and(eq(propertyUsers.propertyId, propertyId), eq(propertyUsers.userId, userId))).limit(1);
    return !!m;
  }

  addMember(propertyId: number, userId: number) {
    return this.db.insert(propertyUsers).values({ propertyId, userId, createdAt: new Date() });
  }

  removeMember(propertyId: number, userId: number) {
    return this.db.delete(propertyUsers).where(and(eq(propertyUsers.propertyId, propertyId), eq(propertyUsers.userId, userId)));
  }

  /** Cabut semua penugasan room user pada properti ini. */
  clearRoomAssignments(userId: number, propertyId: number) {
    return this.db.delete(userRooms).where(and(eq(userRooms.userId, userId),
      inArray(userRooms.roomId, this.db.select({ id: rooms.id }).from(rooms).where(eq(rooms.propertyId, propertyId)))));
  }

  async assignRooms(userId: number, roomIds: number[], actorId: number) {
    if (roomIds.length) {
      await this.db.insert(userRooms).values(roomIds.map((roomId) => ({ userId, roomId, createdAt: new Date(), createdBy: actorId })));
    }
  }
}
