import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { propertyUsers, qrDesigns, roomLogs, roomRules, rooms, rules, userRooms, users } from '../../db/schema/index.js';
import { BaseRepository } from '../../lib/base-repository.js';
import type { PageRequest } from '../../lib/pagination.js';

export type Room = typeof rooms.$inferSelect;
export type QrDesign = typeof qrDesigns.$inferSelect;
export type RuleRow = typeof rules.$inferSelect;
export type QrValues = Partial<Omit<typeof qrDesigns.$inferInsert, 'id' | 'roomId'>>;

export class RoomRepository extends BaseRepository {
  /** Aturan milik properti yang sama dan belum dihapus. */
  async findValidRuleIds(propertyId: number, ids: number[]) {
    if (ids.length === 0) return [];
    const found = await this.db.select({ id: rules.id }).from(rules)
      .where(and(inArray(rules.id, ids), eq(rules.propertyId, propertyId), isNull(rules.deletedAt)));
    return found.map((r) => r.id);
  }

  findPage(propertyId: number, req: PageRequest) {
    return this.db.select().from(rooms).where(and(eq(rooms.propertyId, propertyId), isNull(rooms.deletedAt)))
      .orderBy(desc(rooms.createdAt)).limit(req.size).offset(req.page * req.size);
  }

  async countByProperty(propertyId: number) {
    const [r] = await this.db.select({ total: count() }).from(rooms).where(and(eq(rooms.propertyId, propertyId), isNull(rooms.deletedAt)));
    return r?.total ?? 0;
  }

  findActiveByIdsInProperty(ids: number[], propertyId: number) {
    return this.db.select().from(rooms).where(and(inArray(rooms.id, ids), eq(rooms.propertyId, propertyId), isNull(rooms.deletedAt)));
  }

  async assignedRoomIds(userId: number) {
    return (await this.db.select({ roomId: userRooms.roomId }).from(userRooms).where(eq(userRooms.userId, userId))).map((m) => m.roomId);
  }

  /** Rules (belum dihapus) per room, untuk sekumpulan room sekaligus. */
  findRulesByRoomIds(roomIds: number[]) {
    return this.db.select({ roomId: roomRules.roomId, rule: rules }).from(roomRules)
      .innerJoin(rules, eq(roomRules.ruleId, rules.id)).where(and(inArray(roomRules.roomId, roomIds), isNull(rules.deletedAt)));
  }

  findQrByRoomIds(roomIds: number[]) {
    return this.db.select().from(qrDesigns).where(and(inArray(qrDesigns.roomId, roomIds), isNull(qrDesigns.deletedAt)));
  }

  /** Semua rules room (termasuk yang sudah dihapus) — untuk snapshot log. */
  findAllRulesOfRoom(roomId: number) {
    return this.db.select({ rule: rules }).from(roomRules).innerJoin(rules, eq(roomRules.ruleId, rules.id)).where(eq(roomRules.roomId, roomId));
  }

  async findQrOfRoom(roomId: number) {
    const [q] = await this.db.select().from(qrDesigns).where(and(eq(qrDesigns.roomId, roomId), isNull(qrDesigns.deletedAt))).limit(1);
    return q;
  }


  async insertRoom(v: typeof rooms.$inferInsert) {
    const [room] = await this.db.insert(rooms).values(v).returning();
    return room!;
  }

  async updateRoom(id: number, v: Partial<typeof rooms.$inferInsert>) {
    const [room] = await this.db.update(rooms).set(v).where(eq(rooms.id, id)).returning();
    return room!;
  }

  async softDeleteRoom(id: number) { await this.db.update(rooms).set({ deletedAt: new Date() }).where(eq(rooms.id, id)); }

  async replaceRules(roomId: number, ruleIds: number[]) {
    await this.db.delete(roomRules).where(eq(roomRules.roomId, roomId));
    if (ruleIds.length) await this.db.insert(roomRules).values(ruleIds.map((ruleId) => ({ roomId, ruleId })));
  }

  async addRules(roomId: number, ruleIds: number[]) {
    if (ruleIds.length) await this.db.insert(roomRules).values(ruleIds.map((ruleId) => ({ roomId, ruleId })));
  }

  async assignUsers(roomId: number, userIds: number[], actorId: number, at: Date) {
    if (userIds.length) await this.db.insert(userRooms).values(userIds.map((userId) => ({ userId, roomId, createdAt: at, createdBy: actorId })));
  }

  /** Dari `userIds`, hanya yang anggota properti tersebut. */
  async filterPropertyMembers(propertyId: number, userIds: number[]) {
    const members = await this.db.select({ id: users.id }).from(propertyUsers)
      .innerJoin(users, eq(propertyUsers.userId, users.id))
      .where(and(eq(propertyUsers.propertyId, propertyId), inArray(users.id, userIds)));
    return members.map((m) => m.id);
  }

  async insertQr(v: typeof qrDesigns.$inferInsert) { await this.db.insert(qrDesigns).values(v); }
  async updateQr(id: number, v: QrValues) { await this.db.update(qrDesigns).set(v).where(eq(qrDesigns.id, id)); }

  insertLog(roomId: number, actorId: number, action: string, oldData: unknown, newData: unknown) {
    return this.db.insert(roomLogs).values({ roomId, action, oldData, newData, createdAt: new Date(), createdBy: actorId });
  }

  findLogs(by: { propertyId: number } | { roomId: number }) {
    const where = 'propertyId' in by ? eq(rooms.propertyId, by.propertyId) : eq(roomLogs.roomId, by.roomId);
    return this.db.select({ log: roomLogs, room: rooms, by: users }).from(roomLogs)
      .leftJoin(rooms, eq(roomLogs.roomId, rooms.id)).leftJoin(users, eq(roomLogs.createdBy, users.id))
      .where(where).orderBy(desc(roomLogs.createdAt));
  }
}
