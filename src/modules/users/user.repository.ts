import { and, count, eq, isNull } from 'drizzle-orm';
import { properties, roles, users } from '../../db/schema/index.js';
import { BaseRepository } from '../../lib/base-repository.js';
import { orderBy, type PageRequest } from '../../lib/pagination.js';

export type UserRow = { user: typeof users.$inferSelect; roleName: string | null };
export type UserInsert = typeof users.$inferInsert;

export class UserRepository extends BaseRepository {
  private selectWithRole() {
    return this.db.select({ user: users, roleName: roles.name }).from(users).leftJoin(roles, eq(users.roleId, roles.id));
  }

  findAll(): Promise<UserRow[]> { return this.selectWithRole().orderBy(users.id); }

  findPage(req: PageRequest): Promise<UserRow[]> {
    const cols = { id: users.id, name: users.name, email: users.email, createdAt: users.createdAt, isActive: users.isActive };
    return this.selectWithRole().orderBy(...orderBy(req, cols, users.id)).limit(req.size).offset(req.page * req.size);
  }

  async count() {
    const [r] = await this.db.select({ total: count() }).from(users);
    return r?.total ?? 0;
  }

  async findRowById(id: number): Promise<UserRow | undefined> {
    const [row] = await this.selectWithRole().where(eq(users.id, id)).limit(1);
    return row;
  }

  async findById(id: number) {
    const [u] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return u;
  }

  async emailExists(email: string) {
    const [u] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    return !!u;
  }

  async findRoleByName(name: string) {
    const [r] = await this.db.select().from(roles).where(eq(roles.name, name)).limit(1);
    return r;
  }

  async ownsActiveProperty(userId: number) {
    const [p] = await this.db.select({ id: properties.id }).from(properties)
      .where(and(eq(properties.userId, userId), isNull(properties.deletedAt))).limit(1);
    return !!p;
  }

  async insert(v: UserInsert) {
    const [u] = await this.db.insert(users).values(v).returning();
    return u!;
  }

  async update(id: number, v: Partial<UserInsert>) { await this.db.update(users).set(v).where(eq(users.id, id)); }

  async delete(id: number) { await this.db.delete(users).where(eq(users.id, id)); }
}
