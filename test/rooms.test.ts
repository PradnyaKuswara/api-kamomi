import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { bearer, createTestApp, createUser, seedBasics } from './helpers/test-app.js';
import * as s from '../src/db/schema/index.js';
import { decryptId, encryptId } from '../src/lib/hash-id.js';

let t: Awaited<ReturnType<typeof createTestApp>>;
let ownerA: Record<string, string>, ownerB: Record<string, string>, staffH: Record<string, string>, superH: Record<string, string>;
let propA: number, propB: number, staffId: number, userRoleId: number, adminRoleId: number, ownerAId: number;

const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, headers: Record<string, string>, payload?: object) =>
  t.app.inject({ method, url, headers, payload });

beforeAll(async () => {
  t = await createTestApp();
  ({ adminRoleId } = await seedBasics(t.db));
  userRoleId = (await t.db.insert(s.roles).values({ name: 'USER' }).returning())[0]!.id;
  const superRole = (await t.db.select().from(s.roles).where(eq(s.roles.name, 'SUPER_ADMIN')))[0]!;
  ownerAId = (await createUser(t.db, { email: 'a@x.com', roleId: adminRoleId })).id;
  await createUser(t.db, { email: 'b@x.com', roleId: adminRoleId });
  staffId = (await createUser(t.db, { email: 's@x.com', roleId: userRoleId })).id;
  await createUser(t.db, { email: 'su@x.com', roleId: superRole.id });
  ownerA = await bearer('a@x.com'); ownerB = await bearer('b@x.com'); staffH = await bearer('s@x.com'); superH = await bearer('su@x.com');
  // paket aktif Free untuk A dan B
  const [free] = await t.db.select().from(s.subscriptionPlans);
  for (const email of ['a@x.com', 'b@x.com']) {
    const [u] = await t.db.select().from(s.users).where(eq(s.users.email, email));
    await t.db.insert(s.userSubscriptions).values({ userId: u!.id, planId: free!.id, status: 'ACTIVE', startDate: new Date(), endDate: new Date(Date.now() + 1e10), createdAt: new Date(), updatedAt: new Date() });
  }
  propA = (await call('POST', '/api/properties', ownerA, { name: 'Villa A' })).json().data.id;
  propB = (await call('POST', '/api/properties', ownerB, { name: 'Villa B' })).json().data.id;
}, 60_000);
afterAll(() => t.close());

describe('hash-id (kompat HashUtil Java)', () => {
  it('round-trip dan base64url tanpa padding', () => {
    for (const id of [1, 42, 123456789]) {
      const c = encryptId(id);
      expect(c).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(decryptId(c)).toBe(id);
    }
    expect(decryptId('bukan-kode')).toBeNull();
  });
});

describe('property', () => {
  it('create dengan default dan menautkan pembuat ke property_users', async () => {
    const res = await call('POST', '/api/properties', ownerA, { name: 'Kos C' });
    expect(res.json()).toMatchObject({ code: 201, data: { name: 'Kos C', propertyType: 'HOUSE', address: '-', city: '-', isActive: true } });
    const me = await call('GET', '/api/auth/me', ownerA);
    expect(me.json().data.properties.map((p: { name: string }) => p.name)).toEqual(['Villa A', 'Kos C']);
  });
  it('nama wajib', async () => {
    expect((await call('POST', '/api/properties', ownerA, { name: ' ' })).json().errors).toEqual({ name: 'Name is required' });
  });
});

describe('room', () => {
  let roomId: number;

  it('create membuat QR default, user_rooms pemilik, dan log CREATE', async () => {
    const res = await call('POST', `/api/properties/${propA}/rooms`, ownerA, { roomNumber: '101', wifiSsid: 'wifi', wifiPassword: 'pw' });
    expect(res.json().code).toBe(201);
    const d = res.json().data;
    roomId = d.id;
    expect(d).toMatchObject({ roomNumber: '101', propertyId: propA, isActive: true, rules: [],
      qrDesign: { customTitle: 'Welcome', template: 'modern', cardColor: 'cyan', labelRoom: 'NOMOR KAMAR', showLogo: true } });
    expect(decryptId(d.code)).toBe(roomId);
    const logs = (await call('GET', `/api/properties/${propA}/rooms/${roomId}/logs`, ownerA)).json().data;
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'CREATE', oldData: null, createdByEmail: 'a@x.com' });
    expect(JSON.parse(logs[0].newData)).toMatchObject({ roomNumber: '101', qrDesign: { template: 'modern' } });
  });

  it('isolasi tenant: pemilik B tidak bisa menyentuh room/properti A', async () => {
    expect((await call('GET', `/api/properties/${propA}/rooms`, ownerB)).statusCode).toBe(403);
    expect((await call('GET', `/api/properties/${propA}/rooms/${roomId}`, ownerB)).statusCode).toBe(403);
    expect((await call('PUT', `/api/properties/${propA}/rooms/${roomId}`, ownerB, { roomNumber: 'x' })).statusCode).toBe(403);
    expect((await call('DELETE', `/api/properties/${propA}/rooms/${roomId}`, ownerB)).statusCode).toBe(403);
    expect((await call('POST', `/api/properties/${propA}/rooms`, ownerB, { roomNumber: 'x' })).statusCode).toBe(403);
    expect((await call('GET', `/api/properties/${propA}/user-access`, ownerB)).statusCode).toBe(403);
    expect((await call('GET', `/api/properties/99999/rooms`, ownerA)).statusCode).toBe(404);
  });

  it('update mengganti field, merge QR, dan mencatat log UPDATE', async () => {
    const res = await call('PUT', `/api/properties/${propA}/rooms/${roomId}`, ownerA, { roomNumber: '101A', qrDesign: { template: 'classic' } });
    expect(res.json().data).toMatchObject({ roomNumber: '101A', wifiSsid: null, qrDesign: { template: 'classic', customTitle: 'Welcome' } });
    const logs = (await call('GET', `/api/properties/${propA}/rooms/logs`, ownerA)).json().data;
    expect(logs.map((l: { action: string }) => l.action)).toEqual(['UPDATE', 'CREATE']);
  });

  it('rules hanya dari properti yang sama', async () => {
    const mk = (propertyId: number, title: string) => t.db.insert(s.rules).values({ propertyId, title, sequence: 1, category: 'Wajib', isActive: true, createdAt: new Date(), updatedAt: new Date() }).returning();
    const [mine] = await mk(propA, 'Tenang'); const [theirs] = await mk(propB, 'Orang lain');
    const res = await call('PUT', `/api/properties/${propA}/rooms/${roomId}`, ownerA, { roomNumber: '101A', ruleIds: [mine!.id, theirs!.id] });
    expect(res.json().data.rules.map((r: { title: string }) => r.title)).toEqual(['Tenang']);
    const cleared = await call('PUT', `/api/properties/${propA}/rooms/${roomId}`, ownerA, { roomNumber: '101A', ruleIds: [] });
    expect(cleared.json().data.rules).toEqual([]);
  });

  it('batas kamar paket Free (5) -> 400', async () => {
    for (let i = 0; i < 4; i++) expect((await call('POST', `/api/properties/${propA}/rooms`, ownerA, { roomNumber: `R${i}` })).json().success).toBe(true);
    const over = await call('POST', `/api/properties/${propA}/rooms`, ownerA, { roomNumber: 'extra' });
    expect(over.statusCode).toBe(400);
    expect(over.json().message).toContain('Batas maksimal kamar untuk paket Anda adalah 5 kamar');
  });

  it('soft delete menyembunyikan room tetapi log tetap ada', async () => {
    expect((await call('DELETE', `/api/properties/${propA}/rooms/${roomId}`, ownerA)).json().success).toBe(true);
    expect((await call('GET', `/api/properties/${propA}/rooms/${roomId}`, ownerA)).statusCode).toBe(404);
    const list = (await call('GET', `/api/properties/${propA}/rooms`, ownerA)).json().data;
    expect(list.content.map((r: { id: number }) => r.id)).not.toContain(roomId);
    expect((await call('GET', `/api/properties/${propA}/rooms/${roomId}/logs`, ownerA)).json().data.map((l: { action: string }) => l.action)).toContain('DELETE');
  });
});

describe('staff access', () => {
  it('Free tidak boleh menambah staff; Starter boleh dan USER hanya melihat room yang ditugaskan', async () => {
    const rooms = (await call('GET', `/api/properties/${propA}/rooms`, ownerA)).json().data.content as { id: number }[];
    const body = { userId: staffId, roomIds: [rooms[0]!.id] };
    const denied = await call('POST', `/api/properties/${propA}/user-access`, ownerA, body);
    expect(denied.statusCode).toBe(400);
    expect(denied.json().message).toContain('Paket Free');

    const [starter] = await t.db.insert(s.subscriptionPlans).values({ name: 'Starter', price: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() }).returning();
    await t.db.update(s.userSubscriptions).set({ planId: starter!.id }).where(eq(s.userSubscriptions.userId, ownerAId));

    const ok = await call('POST', `/api/properties/${propA}/user-access`, ownerA, body);
    expect(ok.json().data).toMatchObject({ userId: staffId, roleName: 'USER' });
    expect(ok.json().data.assignedRooms).toHaveLength(1);

    const mine = (await call('GET', `/api/properties/${propA}/rooms`, staffH)).json().data;
    expect(mine.content.map((r: { id: number }) => r.id)).toEqual([rooms[0]!.id]);
    expect((await call('GET', `/api/properties/${propA}/rooms/${rooms[1]!.id}`, staffH)).statusCode).toBe(403);
    expect((await call('POST', `/api/properties/${propA}/rooms`, staffH, { roomNumber: 'x' })).statusCode).toBe(403);
    expect((await call('DELETE', `/api/properties/${propA}/rooms/${rooms[0]!.id}`, staffH)).statusCode).toBe(403);

    const list = (await call('GET', `/api/properties/${propA}/user-access`, ownerA)).json().data;
    expect(list.totalElements).toBe(2);
    expect(list.content.find((u: { userId: number }) => u.userId === staffId).assignedRooms).toHaveLength(1);

    expect((await call('DELETE', `/api/properties/${propA}/user-access/${staffId}`, ownerA)).json().success).toBe(true);
    expect((await call('GET', `/api/properties/${propA}/rooms`, staffH)).statusCode).toBe(403);
  });
});

describe('subscription plans', () => {
  it('/active publik; CRUD hanya SUPER_ADMIN; features sebagai teks JSON', async () => {
    const pub = await t.app.inject('/api/subscription-plans/active');
    expect(pub.json().data.map((p: { name: string }) => p.name)).toContain('Free');
    expect((await call('GET', '/api/subscription-plans', ownerA)).statusCode).toBe(403);

    const c = await call('POST', '/api/subscription-plans', superH, { name: 'Pro', price: 99000, maxRooms: 30, billingCycle: 'MONTHLY', features: '{"qr":true}' });
    expect(c.json()).toMatchObject({ code: 201, data: { name: 'Pro', price: 99000, features: '{"qr":true}', isActive: true, createdBy: { email: 'su@x.com' } } });
    expect(JSON.stringify(c.json())).not.toContain('password');
    const id = c.json().data.id;
    const u = await call('PUT', `/api/subscription-plans/${id}`, superH, { name: 'Pro+', price: 120000, isActive: false });
    expect(u.json().data).toMatchObject({ name: 'Pro+', isActive: false, updatedBy: { email: 'su@x.com' } });
    expect((await call('DELETE', `/api/subscription-plans/${id}`, superH)).json().success).toBe(true);
    expect((await call('GET', `/api/subscription-plans/${id}`, superH)).statusCode).toBe(404);
  });
  it('FAQ publik hanya yang aktif, terurut', async () => {
    const mk = (category: string, sequence: number, isActive: boolean) => ({ category, question: `q${sequence}`, answer: 'a', sequence, isActive, createdAt: new Date(), updatedAt: new Date() });
    await t.db.insert(s.faqs).values([mk('Akun', 2, true), mk('Akun', 1, true), mk('Akun', 3, false), mk('Billing', 1, true)]);
    const all = (await t.app.inject('/api/faqs')).json().data;
    expect(all.map((f: { question: string }) => f.question)).toEqual(['q1', 'q2', 'q1']);
    expect((await t.app.inject('/api/faqs/category/Billing')).json().data).toHaveLength(1);
  });
});
