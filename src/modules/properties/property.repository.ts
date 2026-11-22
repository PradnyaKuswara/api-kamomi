import { and, eq, isNull } from 'drizzle-orm';
import { properties, propertyUsers, users } from '../../db/schema/index.js';
import { BaseRepository } from '../../lib/base-repository.js';

export type PropertyInsert = Omit<typeof properties.$inferInsert, 'id'>;

export class PropertyRepository extends BaseRepository {
  async findUserIdByEmail(email: string) {
    const [u] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    return u?.id;
  }

  /** Properti yang terhubung ke user via property_users dan belum dihapus (soft delete). */
  async findByUserId(userId: number) {
    const rows = await this.db.select({ property: properties }).from(propertyUsers)
      .innerJoin(properties, eq(propertyUsers.propertyId, properties.id))
      .where(and(eq(propertyUsers.userId, userId), isNull(properties.deletedAt)));
    return rows.map((r) => r.property);
  }

  /** Nama semua properti yang diikuti user (termasuk yang soft-deleted, seperti versi sebelumnya). */
  async namesByUserId(userId: number) {
    return (await this.db.select({ name: properties.name }).from(propertyUsers)
      .innerJoin(properties, eq(propertyUsers.propertyId, properties.id)).where(eq(propertyUsers.userId, userId))).map((x) => x.name);
  }

  async createWithOwner(values: PropertyInsert, ownerId: number) {
    return this.transaction(async (tx) => {
      const [property] = await tx.db.insert(properties).values(values).returning();
      await tx.db.insert(propertyUsers).values({ propertyId: property!.id, userId: ownerId, createdAt: new Date() });
      return property!;
    });
  }
}

