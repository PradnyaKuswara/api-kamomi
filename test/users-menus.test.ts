import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestApp, createUser, seedBasics } from './helpers/test-app.js';
import * as s from '../src/db/schema/index.js';

let t: Awaited<ReturnType<typeof createTestApp>>;
let adminH: Record<string, string>, userH: Record<string, string>;
let adminId: number, userId: number, userRoleId: number, adminRoleId: number;

beforeAll(async () => {
  t = await createTestApp();
  ({ adminRoleId } = await seedBasics(t.db));
  const [ur] = await t.db.insert(s.roles).values({ name: 'USER' }).returning();
  userRoleId = ur!.id;
  adminId = (await createUser(t.db, { email: 'admin@x.com', password: 'pass123', roleId: adminRoleId })).id;
  userId = (await createUser(t.db, { email: 'user@x.com', password: 'pass123', roleId: userRoleId })).id;
  adminH = await bearer('admin@x.com');
  userH = await bearer('user@x.com');
}, 60_000);
afterAll(() => t.close());

describe('users', () => {
  it('USER biasa ditolak 403, tanpa token 401', async () => {
    expect((await t.app.inject({ url: '/api/users', headers: userH })).statusCode).toBe(403);
    expect((await t.app.inject('/api/users')).statusCode).toBe(401);
  });

  it('CRUD oleh ADMIN', async () => {
    const list = await t.app.inject({ url: '/api/users', headers: adminH });
    expect(list.json().data).toHaveLength(2);

    const c = await t.app.inject({ method: 'POST', url: '/api/users', headers: adminH,
      payload: { name: 'Baru', email: 'baru@x.com', password: 'abcdef', roleName: 'user' } });
    expect(c.json()).toMatchObject({ code: 201, data: { email: 'baru@x.com', roleName: 'USER', isActive: true } });
    const id = c.json().data.id;

    expect((await t.app.inject({ method: 'POST', url: '/api/users', headers: adminH,
      payload: { name: 'X', email: 'baru@x.com', password: 'abcdef', roleName: 'USER' } })).statusCode).toBe(400);
    expect((await t.app.inject({ method: 'POST', url: '/api/users', headers: adminH,
      payload: { name: 'X', email: 'z@x.com', password: 'abcdef', roleName: 'SUPER_ADMIN' } })).json().message).toBe('Role must be either ADMIN or USER');

    const u = await t.app.inject({ method: 'PUT', url: `/api/users/${id}`, headers: adminH, payload: { name: 'Ganti', isActive: false } });
    expect(u.json().data).toMatchObject({ name: 'Ganti', isActive: false });

    expect((await t.app.inject({ url: '/api/users/99999', headers: adminH })).statusCode).toBe(404);
    expect((await t.app.inject({ method: 'DELETE', url: `/api/users/${id}`, headers: adminH })).json().message).toBe('User deleted successfully');
  });

  it('tidak bisa hapus diri sendiri; pemilik properti tidak bisa dinonaktifkan', async () => {
    const del = await t.app.inject({ method: 'DELETE', url: `/api/users/${adminId}`, headers: adminH });
    expect(del.statusCode).toBe(400);
    await t.db.insert(s.properties).values({ userId, name: 'P', address: 'a', city: 'c', province: 'p', propertyType: 'HOUSE', isActive: true, createdAt: new Date(), updatedAt: new Date() });
    const res = await t.app.inject({ method: 'PUT', url: `/api/users/${userId}`, headers: adminH, payload: { isActive: false } });
    expect(res.statusCode).toBe(400);
  });

  it('paginate memakai bentuk Page Spring', async () => {
    const res = await t.app.inject({ url: '/api/users/paginate?page=0&size=1&sort=email,desc', headers: adminH });
    const d = res.json().data;
    expect(d).toMatchObject({ totalElements: 2, totalPages: 2, size: 1, number: 0, first: true, last: false, numberOfElements: 1 });
    expect(d.content[0].email).toBe('user@x.com');
  });
});

describe('roles', () => {
  it('USER biasa tidak boleh mengubah role; ADMIN boleh', async () => {
    expect((await t.app.inject({ method: 'POST', url: '/api/roles', headers: userH, payload: { name: 'x' } })).statusCode).toBe(403);
    const c = await t.app.inject({ method: 'POST', url: '/api/roles', headers: adminH, payload: { name: 'staff' } });
    expect(c.json().data.name).toBe('STAFF');
    expect((await t.app.inject({ method: 'DELETE', url: `/api/roles/${c.json().data.id}`, headers: adminH })).json().success).toBe(true);
  });
  it('role yang masih dipakai user -> 409, bukan 500', async () => {
    const res = await t.app.inject({ method: 'DELETE', url: `/api/roles/${userRoleId}`, headers: adminH });
    expect(res.statusCode).toBe(409);
  });
});

describe('menus', () => {
  it('sidebar = menu role + override, dikelompokkan per section dan bertingkat', async () => {
    const [sec] = await t.db.insert(s.menuSections).values({ title: 'Utama', orderNo: 1 }).returning();
    const [m1] = await t.db.insert(s.menus).values({ title: 'Dashboard', url: '/d', orderNo: 1, sectionId: sec!.id }).returning();
    const [child] = await t.db.insert(s.menus).values({ title: 'Anak', orderNo: 1, parentId: m1!.id, sectionId: sec!.id }).returning();
    const [loose] = await t.db.insert(s.menus).values({ title: 'Lepas', orderNo: 2 }).returning();
    await t.db.insert(s.roleMenus).values([{ roleId: userRoleId, menuId: m1!.id }, { roleId: userRoleId, menuId: child!.id }]);

    const res = await t.app.inject({ url: `/api/menus/user/${userId}/sidebar`, headers: userH });
    expect(res.json().data).toEqual([{ id: sec!.id, title: 'Utama', orderNo: 1, menus: [
      { id: m1!.id, title: 'Dashboard', url: '/d', icon: null, orderNo: 1, parentId: null,
        children: [{ id: child!.id, title: 'Anak', url: null, icon: null, orderNo: 1, parentId: m1!.id, children: [] }] },
    ] }]);

    const ov = await t.app.inject({ method: 'POST', url: '/api/menus/user-overrides', headers: adminH, payload: { userId, menuId: loose!.id, isAllowed: true } });
    expect(ov.json().success).toBe(true);
    await t.app.inject({ method: 'POST', url: '/api/menus/user-overrides', headers: adminH, payload: { userId, menuId: m1!.id, isAllowed: false } });
    const after = (await t.app.inject({ url: `/api/menus/user/${userId}/sidebar`, headers: userH })).json().data;
    expect(after.map((x: { title: string }) => x.title)).toContain('Lainnya');
    expect(JSON.stringify(after)).not.toContain('Dashboard');
  });

  it('user biasa tidak boleh melihat sidebar orang lain atau membuat override', async () => {
    expect((await t.app.inject({ url: `/api/menus/user/${adminId}/sidebar`, headers: userH })).statusCode).toBe(403);
    expect((await t.app.inject({ method: 'POST', url: '/api/menus/user-overrides', headers: userH, payload: { userId, menuId: 1, isAllowed: true } })).statusCode).toBe(403);
  });
});
