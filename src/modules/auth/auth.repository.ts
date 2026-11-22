import { and, desc, eq, isNull } from 'drizzle-orm';
import { roles, subscriptionPlans, userActivities, userSubscriptions, users } from '../../db/schema/index.js';
import { BaseRepository } from '../../lib/base-repository.js';

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

export class AuthRepository extends BaseRepository {
  async findByEmail(email: string): Promise<UserRow | undefined> {
    const [u] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return u;
  }

  async findById(id: number): Promise<UserRow | undefined> {
    const [u] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return u;
  }

  async findByResetToken(token: string): Promise<UserRow | undefined> {
    const [u] = await this.db.select().from(users).where(eq(users.passwordResetToken, token)).limit(1);
    return u;
  }

  async findWithRoleByEmail(email: string) {
    const [row] = await this.db.select({ user: users, roleName: roles.name })
      .from(users).leftJoin(roles, eq(users.roleId, roles.id)).where(eq(users.email, email)).limit(1);
    return row;
  }

  async insertUser(v: UserInsert) {
    const [u] = await this.db.insert(users).values(v).returning();
    return u;
  }

  async updateUser(id: number, v: Partial<UserInsert>) {
    const [u] = await this.db.update(users).set(v).where(eq(users.id, id)).returning();
    return u;
  }

  async findRoleIdByName(name: string) {
    const [r] = await this.db.select().from(roles).where(eq(roles.name, name)).limit(1);
    return r?.id;
  }

  async findPlanByName(name: string) {
    const [p] = await this.db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, name)).limit(1);
    return p;
  }

  async insertSubscription(v: typeof userSubscriptions.$inferInsert) { await this.db.insert(userSubscriptions).values(v); }

  async hasSubscription(userId: number) {
    const [s] = await this.db.select({ id: userSubscriptions.id }).from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).limit(1);
    return !!s;
  }

  async findActiveSubscription(userId: number) {
    const [row] = await this.db.select({ sub: userSubscriptions, plan: subscriptionPlans })
      .from(userSubscriptions).leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, 'ACTIVE')))
      .orderBy(desc(userSubscriptions.id)).limit(1);
    return row;
  }

  async insertActivity(v: typeof userActivities.$inferInsert) { await this.db.insert(userActivities).values(v); }

  async findOpenLogin(userId: number) {
    const [a] = await this.db.select().from(userActivities)
      .where(and(eq(userActivities.userId, userId), eq(userActivities.activityType, 'LOGIN'), isNull(userActivities.logoutAt)))
      .orderBy(desc(userActivities.id)).limit(1);
    return a;
  }

  async closeActivity(id: number, at: Date) { await this.db.update(userActivities).set({ logoutAt: at }).where(eq(userActivities.id, id)); }
}
