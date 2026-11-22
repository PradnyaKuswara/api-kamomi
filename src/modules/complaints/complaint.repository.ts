import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { complaints, properties, rooms } from '../../db/schema/index.js';
import { BaseRepository } from '../../lib/base-repository.js';
import type { PageRequest } from '../../lib/pagination.js';

export type ComplaintRow = { c: typeof complaints.$inferSelect; roomNumber: string | null; propertyName: string };

export class ComplaintRepository extends BaseRepository {
  private selectJoined() {
    return this.db.select({ c: complaints, roomNumber: rooms.roomNumber, propertyName: properties.name }).from(complaints)
      .innerJoin(rooms, eq(complaints.roomId, rooms.id)).innerJoin(properties, eq(rooms.propertyId, properties.id));
  }

  private listWhere(propertyId: number, status: string | null) {
    return and(eq(rooms.propertyId, propertyId), isNull(complaints.deletedAt), status ? eq(complaints.status, status) : undefined);
  }

  findPage(propertyId: number, status: string | null, req: PageRequest): Promise<ComplaintRow[]> {
    return this.selectJoined().where(this.listWhere(propertyId, status))
      .orderBy(desc(complaints.createdAt)).limit(req.size).offset(req.page * req.size);
  }

  async countByProperty(propertyId: number, status: string | null): Promise<number> {
    const [r] = await this.db.select({ total: count() }).from(complaints)
      .innerJoin(rooms, eq(complaints.roomId, rooms.id)).where(this.listWhere(propertyId, status));
    return r?.total ?? 0;
  }

  async findById(propertyId: number, id: number): Promise<ComplaintRow | undefined> {
    const [row] = await this.selectJoined()
      .where(and(eq(complaints.id, id), eq(rooms.propertyId, propertyId), isNull(complaints.deletedAt))).limit(1);
    return row;
  }

  async updateStatus(id: number, status: string, responseNote?: string) {
    const [c] = await this.db.update(complaints).set({
      status, ...(responseNote !== undefined && { responseNote }), updatedAt: new Date(),
    }).where(eq(complaints.id, id)).returning();
    return c!;
  }

  async softDelete(id: number) {
    await this.db.update(complaints).set({ deletedAt: new Date() }).where(eq(complaints.id, id));
  }

  async findActiveRoomWithProperty(roomId: number) {
    const [row] = await this.db.select({ room: rooms, property: properties }).from(rooms)
      .innerJoin(properties, eq(rooms.propertyId, properties.id)).where(and(eq(rooms.id, roomId), isNull(rooms.deletedAt))).limit(1);
    return row;
  }

  async insert(v: Omit<typeof complaints.$inferInsert, 'id'>) {
    const [c] = await this.db.insert(complaints).values(v).returning();
    return c!;
  }
}
