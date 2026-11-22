import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildApp } from '../src/app.js';
import { loadEnv, toPgConnection } from '../src/config/env.js';
import { signToken, verifyToken } from '../src/lib/jwt.js';
import { isPublicPath } from '../src/plugins/auth.js';
import { NotFoundError } from '../src/errors/app-error.js';
import type { Db } from '../src/db/client.js';

const env = loadEnv({
  NODE_ENV: 'test',
  DB_URL: 'jdbc:postgresql://localhost:5432/kamomi',
  DB_USERNAME: 'u',
  DB_PASSWORD: 'p',
  JWT_SECRET: 'x'.repeat(40),
  JWT_EXPIRATION: '60000',
});

describe('env', () => {
  it('mengubah URL JDBC menjadi koneksi postgres', () => {
    expect(toPgConnection(env)).toBe('postgres://u:p@localhost:5432/kamomi');
  });
  it('menolak JWT_SECRET pendek', () => {
    expect(() => loadEnv({ ...process.env, DB_URL: 'x', JWT_SECRET: 'short', JWT_EXPIRATION: '1' })).toThrow();
  });
});

describe('jwt', () => {
  it.each([40, 50, 70])('sign/verify dengan secret %i byte', async (len) => {
    const secret = 'k'.repeat(len);
    const t = await signToken('a@b.c', { secret, expirationMs: 60_000 });
    expect(await verifyToken(t, secret)).toBe('a@b.c');
    expect(await verifyToken(t, 'z'.repeat(len))).toBeNull();
  });
  it('menolak token kedaluwarsa', async () => {
    const t = await signToken('a@b.c', { secret: env.JWT_SECRET, expirationMs: 1000 }, Date.now() - 10_000);
    expect(await verifyToken(t, env.JWT_SECRET)).toBeNull();
  });
});

describe('public path (setara permitAll Spring)', () => {
  it.each(['/api/auth/login', '/api/public/rooms/x', '/api/faqs', '/api/faqs/1', '/api/subscription-plans/active', '/oauth2/authorization/google'])(
    '%s publik', (p) => expect(isPublicPath(p)).toBe(true));
  it.each(['/api/users', '/api/subscription-plans', '/api/rooms/1'])('%s butuh auth', (p) =>
    expect(isPublicPath(p)).toBe(false));
});

describe('app', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp({ env, db: {} as Db });
    app.get('/api/me-test', async (req) => ({ email: req.userEmail }));
    app.get('/api/public/boom', async () => { throw new NotFoundError('Room tidak ditemukan'); });
    app.get('/api/public/crash', async () => { throw new Error('secret detail'); });
    app.post('/api/public/echo', { schema: { body: z.object({ email: z.string().email() }) } }, async (req) => req.body);
  });
  afterAll(() => app.close());

  it('health publik dengan envelope', async () => {
    const res = await app.inject('/api/public/health');
    expect(res.json()).toEqual({ success: true, code: 200, message: 'OK', data: { status: 'up' }, errors: null });
  });
  it('401 tanpa token pada route privat', async () => {
    const res = await app.inject('/api/me-test');
    expect(res.statusCode).toBe(401);
    expect(res.json().success).toBe(false);
  });
  it('menerima Bearer dan ?token=', async () => {
    const t = await signToken('a@b.c', { secret: env.JWT_SECRET, expirationMs: env.JWT_EXPIRATION });
    expect((await app.inject({ url: '/api/me-test', headers: { authorization: `Bearer ${t}` } })).json()).toEqual({ email: 'a@b.c' });
    expect((await app.inject(`/api/me-test?token=${t}`)).json()).toEqual({ email: 'a@b.c' });
  });
  it('AppError -> envelope sesuai status', async () => {
    const res = await app.inject('/api/public/boom');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ success: false, code: 404, message: 'Room tidak ditemukan', data: null });
  });
  it('500 tidak membocorkan detail', async () => {
    const res = await app.inject('/api/public/crash');
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.json())).not.toContain('secret detail');
  });
  it('validasi gagal -> 400 { field: message }', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/public/echo', payload: { email: 'bukan-email' } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ success: false, code: 400, message: 'Validation failed' });
    expect(res.json().errors).toHaveProperty('email');
  });
  it('CORS hanya untuk origin frontend', async () => {
    const ok = await app.inject({ method: 'OPTIONS', url: '/api/x', headers: { origin: env.FRONTEND_URL, 'access-control-request-method': 'GET' } });
    expect(ok.headers['access-control-allow-origin']).toBe(env.FRONTEND_URL);
    const bad = await app.inject({ method: 'OPTIONS', url: '/api/x', headers: { origin: 'http://evil.test', 'access-control-request-method': 'GET' } });
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});
