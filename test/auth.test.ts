import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestApp, createUser, seedBasics } from './helpers/test-app.js';
import * as s from '../src/db/schema/index.js';

let t: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  t = await createTestApp();
  const { adminRoleId } = await seedBasics(t.db);
  await createUser(t.db, { email: 'system@kamomi.id', roleId: adminRoleId }); // id=1
  await createUser(t.db, { email: 'off@x.com', password: 'secret1', roleId: adminRoleId, isActive: false });
}, 60_000);
afterAll(() => t.close());

const post = (url: string, payload: unknown, headers: Record<string, string> = {}) =>
  t.app.inject({ method: 'POST', url, payload: payload as object, headers });

describe('auth flow', () => {
  let token = '';

  it('register membuat user ADMIN + paket Free + log LOGIN', async () => {
    const res = await post('/api/auth/register', { name: 'Budi', email: 'budi@x.com', password: 'rahasia1' });
    expect(res.statusCode).toBe(200); // Java: HTTP 200, code 201 di body
    const body = res.json();
    expect(body).toMatchObject({ success: true, code: 201, message: 'Registration successful', errors: null });
    expect(body.data).toMatchObject({ email: 'budi@x.com', name: 'Budi' });
    token = body.data.token;
    const subs = await t.db.select().from(s.userSubscriptions);
    expect(subs).toHaveLength(1);
    expect(subs[0]!.status).toBe('ACTIVE');
    expect((await t.db.select().from(s.userActivities)).map((a) => a.activityType)).toEqual(['LOGIN']);
  });

  it('register email duplikat -> 400 dengan pesan di message & errors', async () => {
    const res = await post('/api/auth/register', { name: 'B', email: 'budi@x.com', password: 'rahasia1' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ success: false, message: 'Email already registered', errors: 'Email already registered' });
  });

  it('register validasi: pesan per field', async () => {
    const res = await post('/api/auth/register', { name: '', email: 'bad', password: '123' });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors).toMatchObject({
      name: 'Name is required', email: 'Email format is invalid', password: 'Password must be at least 6 characters',
    });
  });

  it('login benar/salah/nonaktif', async () => {
    const good = await post('/api/auth/login', { email: 'budi@x.com', password: 'rahasia1' });
    expect(good.json()).toMatchObject({ success: true, code: 200, message: 'Login successful' });
    token = good.json().data.token;
    expect((await post('/api/auth/login', { email: 'budi@x.com', password: 'salah!!' })).statusCode).toBe(401);
    expect((await post('/api/auth/login', { email: 'nope@x.com', password: 'salah!!' })).json().message).toBe('Invalid email or password');
    const off = await post('/api/auth/login', { email: 'off@x.com', password: 'secret1' });
    expect(off.statusCode).toBe(403);
    expect(off.json().message).toBe('User account is inactive');
  });

  it('/me dengan token mengembalikan profil + subscription + properties', async () => {
    const res = await t.app.inject({ url: '/api/auth/me', headers: { authorization: `Bearer ${token}` } });
    const d = res.json().data;
    expect(d).toMatchObject({ email: 'budi@x.com', roleName: 'ADMIN', isActive: true, properties: [] });
    expect(d.subscription.plan).toMatchObject({ name: 'Free', price: 0, maxRooms: 1 });
    expect(typeof d.subscription.plan.features).toBe('string'); // kompat: teks JSON seperti Java
    expect(JSON.parse(d.subscription.plan.features)).toEqual({ qr: true });
  });

  it('/me tanpa token -> HTTP 200 success=false code=401 (perilaku Java)', async () => {
    const res = await t.app.inject('/api/auth/me');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: false, code: 401, message: 'Unauthorized' });
  });

  it('logout menutup sesi LOGIN dan mencatat LOGOUT', async () => {
    const res = await post('/api/auth/logout', {}, { authorization: `Bearer ${token}` });
    expect(res.json()).toMatchObject({ success: true, message: 'Logout successful' });
    const acts = await t.db.select().from(s.userActivities).where(eq(s.userActivities.activityType, 'LOGOUT'));
    expect(acts).toHaveLength(1);
    const logins = await t.db.select().from(s.userActivities).where(eq(s.userActivities.activityType, 'LOGIN'));
    expect(logins.some((l) => l.logoutAt)).toBe(true);
  });

  it('forgot + reset password', async () => {
    const same = await post('/api/auth/forgot-password', { email: 'tidakada@x.com' });
    expect(same.json().message).toContain('Jika email terdaftar');
    expect(t.mails).toHaveLength(0);

    await post('/api/auth/forgot-password', { email: 'budi@x.com' });
    expect(t.mails).toHaveLength(1);
    const code = /token-box'>(\d{6})</.exec(t.mails[0]!.html)![1]!;

    expect((await post('/api/auth/reset-password', { token: '000000', newPassword: 'baru123' })).statusCode).toBe(400);
    expect((await post('/api/auth/reset-password', { token: code, newPassword: 'baru123' })).json().success).toBe(true);
    expect((await post('/api/auth/reset-password', { token: code, newPassword: 'baru456' })).statusCode).toBe(400); // sekali pakai
    expect((await post('/api/auth/login', { email: 'budi@x.com', password: 'baru123' })).statusCode).toBe(200);
  });

  it('reset password dengan kode kedaluwarsa ditolak', async () => {
    await t.db.update(s.users).set({ passwordResetToken: '111111', passwordResetExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(s.users.email, 'budi@x.com'));
    expect((await post('/api/auth/reset-password', { token: '111111', newPassword: 'baru999' })).statusCode).toBe(400);
  });
});
