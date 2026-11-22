import { eq } from 'drizzle-orm';
import { roles } from '../../db/schema/index.js';
import { BaseRepository } from '../../lib/base-repository.js';

export class RoleRepository extends BaseRepository {
  findAll() { return this.db.select().from(roles).orderBy(roles.id); }

  async findById(id: number) {
    const [role] = await this.db.select().from(roles).where(eq(roles.id, id)).limit(1);
    return role;
  }

  async insert(name: string) {
    const now = new Date();
    const [role] = await this.db.insert(roles).values({ name, createdAt: now, updatedAt: now }).returning();
    return role!;
  }

  async update(id: number, name: string) {
    const [role] = await this.db.update(roles).set({ name, updatedAt: new Date() }).where(eq(roles.id, id)).returning();
    return role!;
  }

  async delete(id: number) { await this.db.delete(roles).where(eq(roles.id, id)); }
}
