import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { notifications, properties, users } from '../../db/schema/index.js';
import { BaseRepository } from '../../lib/base-repository.js';

export type NotificationRow = { n: typeof notifications.$inferSelect; propertyName: string | null };
export type NotificationInsert = typeof notifications.$inferInsert;

export class NotificationRepository extends BaseRepository {
  private selectJoined() {
    return this.db.select({ n: notifications, propertyName: properties.name }).from(notifications)
      .leftJoin(properties, eq(notifications.propertyId, properties.id));
  }

  async findUserIdByEmail(email: string) {
    const [u] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    return u?.id;
  }

  async insert(v: NotificationInsert): Promise<NotificationRow> {
    const [n] = await this.db.insert(notifications).values(v).returning();
    const [row] = await this.selectJoined().where(eq(notifications.id, n!.id)).limit(1);
    return row!;
  }

  private listWhere(userId: number) { return and(eq(notifications.userId, userId), isNull(notifications.deletedAt)); }

  findPage(userId: number, page: number, size: number): Promise<NotificationRow[]> {
    return this.selectJoined().where(this.listWhere(userId)).orderBy(desc(notifications.createdAt)).limit(size).offset(page * size);
  }

  async countAll(userId: number) {
    const [r] = await this.db.select({ total: count() }).from(notifications).where(this.listWhere(userId));
    return r?.total ?? 0;
  }

  async countUnread(userId: number) {
    const [r] = await this.db.select({ n: count() }).from(notifications).where(and(this.listWhere(userId), eq(notifications.isRead, false)));
    return r?.n ?? 0;
  }

  async findOwned(userId: number, id: number): Promise<NotificationRow | undefined> {
    const [row] = await this.selectJoined().where(and(eq(notifications.id, id), this.listWhere(userId))).limit(1);
    return row;
  }

  async markRead(id: number) { await this.db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)); }

  async markAllRead(userId: number) {
    await this.db.update(notifications).set({ isRead: true }).where(and(this.listWhere(userId), eq(notifications.isRead, false)));
  }

  async softDelete(id: number) { await this.db.update(notifications).set({ deletedAt: new Date() }).where(eq(notifications.id, id)); }
}
