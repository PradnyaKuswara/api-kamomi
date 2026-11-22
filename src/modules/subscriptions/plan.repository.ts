import { count, eq } from 'drizzle-orm';
import { subscriptionPlans, users } from '../../db/schema/index.js';
import { BaseRepository } from '../../lib/base-repository.js';
import { orderBy, type PageRequest } from '../../lib/pagination.js';

export type PlanInsert = Omit<typeof subscriptionPlans.$inferInsert, 'id'>;

export class PlanRepository extends BaseRepository {
  findAll() { return this.db.select().from(subscriptionPlans).orderBy(subscriptionPlans.id); }

  findActive() {
    return this.db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true)).orderBy(subscriptionPlans.id);
  }

  findPage(req: PageRequest) {
    const cols = { id: subscriptionPlans.id, name: subscriptionPlans.name, price: subscriptionPlans.price, createdAt: subscriptionPlans.createdAt };
    return this.db.select().from(subscriptionPlans).orderBy(...orderBy(req, cols, subscriptionPlans.id)).limit(req.size).offset(req.page * req.size);
  }

  async count() {
    const [r] = await this.db.select({ total: count() }).from(subscriptionPlans);
    return r?.total ?? 0;
  }

  async findById(id: number) {
    const [p] = await this.db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
    return p;
  }

  async insert(v: PlanInsert) {
    const [p] = await this.db.insert(subscriptionPlans).values(v).returning();
    return p!;
  }

  async update(id: number, v: Partial<PlanInsert>) {
    const [p] = await this.db.update(subscriptionPlans).set(v).where(eq(subscriptionPlans.id, id)).returning();
    return p!;
  }

  async delete(id: number) { await this.db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id)); }

  async findUserRef(id: number) {
    const [u] = await this.db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, id)).limit(1);
    return u ?? null;
  }
}
