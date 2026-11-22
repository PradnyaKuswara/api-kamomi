import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { bearer, createTestApp, createUser, seedBasics } from './helpers/test-app.js';
import * as s from '../src/db/schema/index.js';
import { encryptId } from '../src/lib/hash-id.js';

let t: Awaited<ReturnType<typeof createTestApp>>;
let ownerH: Record<string, string>, otherH: Record<string, string>;
let propId: number, ownerId: number, roomCode: string;

const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, headers: Record<string, string> = {}, payload?: object) =>
  t.app.inject({ method, url, headers, payload });

beforeAll(async () => {
  t = await createTestApp();
  const { adminRoleId } = await seedBasics(t.db);
  ownerId = (await createUser(t.db, { email: 'o@x.com', roleId: adminRoleId })).id;
  await createUser(t.db, { email: 'x@x.com', roleId: adminRoleId });
  ownerH = await bearer('o@x.com'); otherH = await bearer('x@x.com');
  const [free] = await t.db.select().from(s.subscriptionPlans);
  await t.db.insert(s.userSubscriptions).values({ userId: ownerId, planId: free!.id, status: 'ACTIVE', startDate: new Date(), endDate: new Date(Date.now() + 1e10), createdAt: new Date(), updatedAt: new Date() });
  propId = (await call('POST', '/api/properties', ownerH, { name: 'Villa Kamomi' })).json().data.id;
  const room = (await call('POST', `/api/properties/${propId}/rooms`, ownerH, { roomNumber: '7', wifiSsid: 'w', wifiPassword: 'p' })).json().data;
  roomCode = room.code;
}, 60_000);
afterAll(() => t.close());

describe('rules / guides / contacts', () => {
  it('rule: CRUD + log + default kategori; hapus hanya ADMIN', async () => {
    const c = await call('POST', `/api/properties/${propId}/rules`, ownerH, { title: 'Dilarang merokok' });
    expect(c.json()).toMatchObject({ code: 201, data: { title: 'Dilarang merokok', category: 'Mandatory', sequence: 0, isActive: true } });
    const id = c.json().data.id;
    const u = await call('PUT', `/api/properties/${propId}/rules/${id}`, ownerH, { title: 'Dilarang merokok!', category: 'Larangan' });
    expect(u.json().data).toMatchObject({ title: 'Dilarang merokok!', category: 'Larangan' });
    const logs = await t.db.select().from(s.ruleLogs).where(eq(s.ruleLogs.ruleId, id));
    expect(logs.map((l) => l.action).sort()).toEqual(['CREATE', 'UPDATE']);
    expect(await call('DELETE', `/api/properties/${propId}/rules/${id}`, ownerH)).toMatchObject({ statusCode: 200 });
    expect((await call('GET', `/api/properties/${propId}/rules`, ownerH)).json().data.totalElements).toBe(0);
  });

  it('isolasi tenant & id properti salah -> 404/403', async () => {
    const id = (await call('POST', `/api/properties/${propId}/rules`, ownerH, { title: 'R' })).json().data.id;
    expect((await call('GET', `/api/properties/${propId}/rules`, otherH)).statusCode).toBe(403);
    expect((await call('PUT', `/api/properties/${propId}/rules/${id}`, otherH, { title: 'hack' })).statusCode).toBe(403);
    expect((await call('PUT', `/api/properties/99999/rules/${id}`, ownerH, { title: 'x' })).statusCode).toBe(404);
  });

  it('guide: steps wajib dan disimpan sebagai array', async () => {
    expect((await call('POST', `/api/properties/${propId}/facility-guides`, ownerH, { name: 'AC', title: 'Cara pakai AC' })).statusCode).toBe(400);
    const c = await call('POST', `/api/properties/${propId}/facility-guides`, ownerH, { name: 'AC', title: 'Cara pakai AC', steps: ['Nyalakan', 'Atur suhu'] });
    expect(c.json().data).toMatchObject({ icon: 'Wind', steps: ['Nyalakan', 'Atur suhu'] });
    const log = (await t.db.select().from(s.facilityGuideLogs))[0]!;
    expect(log.action).toBe('CREATE');
  });

  it('contact: default & link diturunkan dari tipe', async () => {
    const wa = await call('POST', `/api/properties/${propId}/contacts`, ownerH, { name: 'Budi', role: 'Host', contactType: 'whatsapp', contactValue: '0812-3456-789' });
    expect(wa.json().data).toMatchObject({ contactType: 'WHATSAPP', link: 'https://wa.me/628123456789', actionText: 'Chat WhatsApp', color: 'emerald', icon: 'MessageCircle' });
    const mail = await call('POST', `/api/properties/${propId}/contacts`, ownerH, { name: 'A', role: 'B', contactType: 'EMAIL', contactValue: 'a@b.c' });
    expect(mail.json().data).toMatchObject({ link: 'mailto:a@b.c', icon: 'Mail' });
    const bad = await call('POST', `/api/properties/${propId}/contacts`, ownerH, { name: '', role: 'x', contactType: 'PHONE', contactValue: '1' });
    expect(bad.json().errors).toEqual({ name: 'Nama kontak tidak boleh kosong' });
  });
});

describe('public room', () => {
  it('mengembalikan detail lengkap tanpa login', async () => {
    const res = await call('GET', `/api/public/rooms/${roomCode}`);
    const d = res.json().data;
    expect(d).toMatchObject({ roomNumber: '7', wifiSsid: 'w', wifiPassword: 'p', propertyName: 'Villa Kamomi', isSuspended: false,
      qrDesign: { template: 'modern' } });
    expect(d.contacts.length).toBeGreaterThan(0);
    expect(d.facilityGuides.length).toBeGreaterThan(0);
  });

  it('kode tidak valid -> HTTP 200 dengan code 400; tidak ada -> code 500 (perilaku Java)', async () => {
    const bad = await call('GET', '/api/public/rooms/ngawur');
    expect(bad.statusCode).toBe(200);
    expect(bad.json()).toMatchObject({ success: false, code: 400, message: 'Invalid room code format' });
    const none = await call('GET', `/api/public/rooms/${encryptId(99999)}`);
    expect(none.json()).toMatchObject({ success: false, code: 500, message: 'Room not found' });
  });

  it('pemilik tanpa langganan aktif lewat masa tenggang -> isSuspended', async () => {
    await t.db.update(s.userSubscriptions).set({ endDate: new Date(Date.now() - 8 * 86_400_000) }).where(eq(s.userSubscriptions.userId, ownerId));
    const d = (await call('GET', `/api/public/rooms/${roomCode}`)).json().data;
    expect(d).toMatchObject({ isSuspended: true, propertyName: 'Villa Kamomi', roomNumber: '7', rules: null, wifiPassword: null });
    // masih dalam masa tenggang 7 hari
    await t.db.update(s.userSubscriptions).set({ endDate: new Date(Date.now() - 3 * 86_400_000) }).where(eq(s.userSubscriptions.userId, ownerId));
    expect((await call('GET', `/api/public/rooms/${roomCode}`)).json().data.isSuspended).toBe(false);
  });
});

describe('complaints + notifications', () => {
  let complaintId: number;
  it('tamu mengirim keluhan -> notifikasi untuk pemilik', async () => {
    const res = await call('POST', '/api/public/complaints', {}, { roomCode, category: 'AC', description: 'AC mati', guestName: 'Siti' });
    expect(res.json()).toMatchObject({ success: true, code: 201, message: 'Keluhan berhasil dikirim ke pengelola', data: { status: 'PENDING', roomNumber: '7', propertyName: 'Villa Kamomi' } });
    complaintId = res.json().data.id;

    const n = (await call('GET', '/api/notifications', ownerH)).json().data;
    expect(n.content[0]).toMatchObject({ title: 'Keluhan Baru - Kamar 7', message: 'Siti melaporkan keluhan: AC mati', type: 'NEW_COMPLAINT', referenceId: complaintId, isRead: false, propertyName: 'Villa Kamomi' });
    expect((await call('GET', '/api/notifications/unread-count', ownerH)).json().data).toBe(1);
  });

  it('validasi publik: HTTP 200 + code 400 + pesan', async () => {
    const r1 = await call('POST', '/api/public/complaints', {}, { category: 'AC', description: 'x' });
    expect(r1.json()).toMatchObject({ success: false, code: 400, message: 'Kode kamar wajib diisi' });
    const r2 = await call('POST', '/api/public/complaints', {}, { roomCode: 'zzz', category: 'AC', description: 'x' });
    expect(r2.json().message).toBe('Kode kamar tidak valid');
  });

  it('pemilik mengelola keluhan; orang lain ditolak', async () => {
    expect((await call('GET', `/api/properties/${propId}/complaints`, otherH)).statusCode).toBe(403);
    const list = (await call('GET', `/api/properties/${propId}/complaints?status=pending`, ownerH)).json().data;
    expect(list.totalElements).toBe(1);
    expect((await call('GET', `/api/properties/${propId}/complaints?status=RESOLVED`, ownerH)).json().data.totalElements).toBe(0);

    expect((await call('PUT', `/api/properties/${propId}/complaints/${complaintId}/status`, ownerH, {})).statusCode).toBe(400);
    const up = await call('PUT', `/api/properties/${propId}/complaints/${complaintId}/status`, ownerH, { status: 'resolved', responseNote: '  sudah diperbaiki ' });
    expect(up.json().data).toMatchObject({ status: 'RESOLVED', responseNote: 'sudah diperbaiki' });
    expect((await call('DELETE', `/api/properties/${propId}/complaints/${complaintId}`, ownerH)).json().success).toBe(true);
    expect((await call('GET', `/api/properties/${propId}/complaints`, ownerH)).json().data.totalElements).toBe(0);
  });

  it('notifikasi: tandai baca, semua dibaca, hapus; hanya milik sendiri', async () => {
    const n = (await call('GET', '/api/notifications', ownerH)).json().data.content[0];
    expect((await call('PUT', `/api/notifications/${n.id}/read`, otherH)).statusCode).toBe(404);
    expect((await call('PUT', `/api/notifications/${n.id}/read`, ownerH)).json().data.isRead).toBe(true);
    expect((await call('GET', '/api/notifications/unread-count', ownerH)).json().data).toBe(0);
    expect((await call('PUT', '/api/notifications/read-all', ownerH)).json().success).toBe(true);
    expect((await call('DELETE', `/api/notifications/${n.id}`, ownerH)).json().success).toBe(true);
    expect((await call('GET', '/api/notifications', ownerH)).json().data.totalElements).toBe(0);
  });

  it('SSE: INIT lalu NOTIFICATION real-time lewat ?token=', async () => {
    const address = await t.app.listen({ port: 0, host: '127.0.0.1' });
    const token = (await bearer('o@x.com')).authorization.slice(7);
    const ac = new AbortController();
    const res = await fetch(`${address}/api/notifications/stream?token=${token}`, { signal: ac.signal, headers: { origin: 'http://localhost:4321' } });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:4321');

    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const until = async (needle: string) => { while (!buf.includes(needle)) buf += dec.decode((await reader.read()).value); };
    await until('Connected to Kamomi Notification Stream');
    expect(buf).toContain('event: INIT');

    await call('POST', '/api/public/complaints', {}, { roomCode, category: 'Air', description: 'Air mati', guestName: 'Joko' });
    await until('Joko melaporkan keluhan: Air mati');
    expect(buf).toContain('event: NOTIFICATION');
    ac.abort();
  });
});

describe('rate limit', () => {
  it('login dibatasi 10/menit per IP dan memakai envelope 429', async () => {
    const lt = await createTestApp({ RATE_LIMIT: true });
    try {
      let last = 0;
      for (let i = 0; i < 12; i++) last = (await lt.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.c', password: 'x' } })).statusCode;
      expect(last).toBe(429);
      const res = await lt.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.c', password: 'x' } });
      expect(res.json()).toMatchObject({ success: false, code: 429 });
    } finally { await lt.close(); }
  }, 30_000);
});
