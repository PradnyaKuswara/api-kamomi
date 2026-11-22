import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from './helpers/test-app.js';
import { runBootstrap, runSeed } from '../src/db/bootstrap.js';
import * as s from '../src/db/schema/index.js';

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => { t = await createTestDb(); }, 60_000);
afterAll(() => t.pg.close());

describe('seed & bootstrap', () => {
  it('idempoten: dijalankan dua kali menghasilkan data yang sama', async () => {
    for (let i = 0; i < 2; i++) { await runSeed(t.db); await runBootstrap(t.db); }
    expect((await t.db.select().from(s.roles)).map((r) => r.name).sort()).toEqual(['ADMIN', 'SUPER_ADMIN', 'USER']);
    expect(await t.db.select().from(s.faqs)).toHaveLength(15);
    expect((await t.db.select().from(s.subscriptionPlans)).map((p) => p.name).sort()).toEqual(['Business', 'Enterprise', 'Free', 'Starter']);
    expect(await t.db.select().from(s.menus)).toHaveLength(10);
    expect(await t.db.select().from(s.menuSections)).toHaveLength(4);
  });

  it('USER tidak mendapat menu Management Users; ADMIN mendapat semua', async () => {
    const titles = async (role: string) => (await t.db.select({ title: s.menus.title }).from(s.roleMenus)
      .innerJoin(s.roles, eq(s.roleMenus.roleId, s.roles.id)).innerJoin(s.menus, eq(s.roleMenus.menuId, s.menus.id)).where(eq(s.roles.name, role))).map((r) => r.title);
    expect(await titles('ADMIN')).toHaveLength(10);
    const user = await titles('USER');
    expect(user).toHaveLength(9);
    expect(user).not.toContain('Management Users');
  });

  it('bootstrap mengembalikan paket ke nilai default dan menyimpan features sebagai array jsonb', async () => {
    await t.db.update(s.subscriptionPlans).set({ price: 1 }).where(eq(s.subscriptionPlans.name, 'Starter'));
    await runBootstrap(t.db);
    const [p] = await t.db.select().from(s.subscriptionPlans).where(eq(s.subscriptionPlans.name, 'Starter'));
    expect(p).toMatchObject({ price: 49000, maxRooms: 15, billingCycle: 'MONTHLY', isActive: true });
    expect(Array.isArray(p!.features)).toBe(true);
  });
});
