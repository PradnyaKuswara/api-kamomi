import { and, desc, eq, isNull } from 'drizzle-orm';
import { contacts, facilityGuides, properties, qrDesigns, roomRules, rooms, rules } from '../../db/schema/index.js';
import { BaseRepository } from '../../lib/base-repository.js';

export class PublicRoomRepository extends BaseRepository {
  async findRoomWithProperty(roomId: number) {
    const [row] = await this.db.select({ room: rooms, property: properties }).from(rooms)
      .innerJoin(properties, eq(rooms.propertyId, properties.id)).where(and(eq(rooms.id, roomId), isNull(rooms.deletedAt))).limit(1);
    return row;
  }

  async findQr(roomId: number) {
    const [q] = await this.db.select().from(qrDesigns).where(and(eq(qrDesigns.roomId, roomId), isNull(qrDesigns.deletedAt))).limit(1);
    return q;
  }

  async findRules(roomId: number) {
    const rows = await this.db.select({ r: rules }).from(roomRules).innerJoin(rules, eq(roomRules.ruleId, rules.id))
      .where(and(eq(roomRules.roomId, roomId), isNull(rules.deletedAt)));
    return rows.map(({ r }) => r);
  }

  findContacts(propertyId: number) {
    return this.db.select().from(contacts).where(and(eq(contacts.propertyId, propertyId), isNull(contacts.deletedAt))).orderBy(desc(contacts.createdAt));
  }

  findGuides(propertyId: number) {
    return this.db.select().from(facilityGuides).where(and(eq(facilityGuides.propertyId, propertyId), isNull(facilityGuides.deletedAt))).orderBy(desc(facilityGuides.createdAt));
  }
}
