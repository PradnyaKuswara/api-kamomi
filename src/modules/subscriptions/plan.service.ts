import type { subscriptionPlans } from '../../db/schema/index.js';
import { NotFoundError } from '../../errors/app-error.js';
import { fromJsonText, toJsonText } from '../../lib/json-text.js';
import { toPage, type PageRequest } from '../../lib/pagination.js';
import type { PlanRepository } from './plan.repository.js';

type Plan = typeof subscriptionPlans.$inferSelect;

export interface PlanInput {
  name: string; price: number; description?: string | null; maxRooms?: number | null; billingCycle?: string | null;
  features?: string | Record<string, unknown> | unknown[] | null; isActive?: boolean | null;
}

const featuresValue = (f: unknown) => (typeof f === 'string' ? fromJsonText(f) : (f ?? null));

export class PlanService {
  constructor(private readonly repo: PlanRepository) {}

  private async userRef(id: number | null) { return id == null ? null : this.repo.findUserRef(id); }

  // Java mengembalikan entity mentah; createdBy/updatedBy dikurangi menjadi {id,name,email} agar hash password tak ikut bocor.
  private async dto(p: Plan) {
    return {
      id: p.id, name: p.name, price: p.price, description: p.description, maxRooms: p.maxRooms, billingCycle: p.billingCycle,
      features: toJsonText(p.features), isActive: p.isActive, createdAt: p.createdAt, updatedAt: p.updatedAt, deletedAt: p.deletedAt,
      createdBy: await this.userRef(p.createdBy), updatedBy: await this.userRef(p.updatedBy),
    };
  }

  private async getOrThrow(id: number) {
    const p = await this.repo.findById(id);
    if (!p) throw new NotFoundError(`Subscription plan with ID ${id} not found!`);
    return p;
  }

  async listActive() {
    return (await this.repo.findActive()).map((p) => ({
      name: p.name, price: p.price, description: p.description, maxRooms: p.maxRooms,
      billingCycle: p.billingCycle, features: toJsonText(p.features),
    }));
  }

  async listAll() { return Promise.all((await this.repo.findAll()).map((p) => this.dto(p))); }

  async page(req: PageRequest) {
    const [rows, total] = await Promise.all([this.repo.findPage(req), this.repo.count()]);
    return toPage(await Promise.all(rows.map((p) => this.dto(p))), total, req);
  }

  async get(id: number) { return this.dto(await this.getOrThrow(id)); }

  async create(b: PlanInput, actorId: number) {
    const now = new Date();
    return this.dto(await this.repo.insert({
      name: b.name, price: b.price, description: b.description ?? null, maxRooms: b.maxRooms ?? null,
      billingCycle: b.billingCycle ?? null, features: featuresValue(b.features), isActive: true,
      createdAt: now, updatedAt: now, createdBy: actorId,
    }));
  }

  async update(id: number, b: PlanInput, actorId: number) {
    const existing = await this.getOrThrow(id);
    return this.dto(await this.repo.update(existing.id, {
      name: b.name, price: b.price, description: b.description ?? null, maxRooms: b.maxRooms ?? null,
      billingCycle: b.billingCycle ?? null, features: featuresValue(b.features), isActive: b.isActive ?? existing.isActive,
      updatedAt: new Date(), updatedBy: actorId,
    }));
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    await this.repo.delete(id);
  }
}
