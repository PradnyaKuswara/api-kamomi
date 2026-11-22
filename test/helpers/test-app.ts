import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import bcrypt from 'bcrypt';
import { buildApp } from '../../src/app.js';
import { loadEnv } from '../../src/config/env.js';
import type { Db } from '../../src/db/client.js';
import * as schema from '../../src/db/schema/index.js';
import type { Mailer } from '../../src/lib/email.js';

export const testEnv = loadEnv({
  NODE_ENV: 'test',
  DB_URL: 'postgres://localhost/test',
  JWT_SECRET: 'x'.repeat(40),
  JWT_EXPIRATION: '3600000',
  RATE_LIMIT: 'false',
});

/** Postgres in-process dengan skema yang sama persis dari migrasi baseline. */
export async function createTestDb() {
  const pg = new PGlite();
  await pg.exec('CREATE SCHEMA kamomi');
  const dir = join(import.meta.dirname, '../../drizzle');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(join(dir, f), 'utf8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await pg.exec(stmt);
    }
  }
  const db = drizzle(pg);
  return { pg, db: db as unknown as Db };
}

export async function createTestApp(envOverride: Partial<typeof testEnv> = {}) {
  const { pg, db } = await createTestDb();
  const mails: { to: string; subject: string; html: string }[] = [];
  const mailer: Mailer = { sendHtml: async (to, subject, html) => { mails.push({ to, subject, html }); } };
  const app = await buildApp({ env: { ...testEnv, ...envOverride }, db, mailer });
  await app.ready();
  return { app, db, pg, mails, close: async () => { await app.close(); await pg.close(); } };
}

/** Data minimum yang diasumsikan service: role ADMIN, plan Free, dan user sistem id=1. */
export async function seedBasics(db: Db) {
  const [admin] = await db.insert(schema.roles).values({ name: 'ADMIN' }).returning();
  await db.insert(schema.roles).values({ name: 'SUPER_ADMIN' });
  await db.insert(schema.subscriptionPlans).values({
    name: 'Free', price: 0, maxRooms: 1, billingCycle: 'MONTHLY', features: { qr: true },
    isActive: true, createdAt: new Date(), updatedAt: new Date(),
  });
  return { adminRoleId: admin!.id };
}

export async function createUser(db: Db, o: { email: string; password?: string; roleId: number; name?: string; isActive?: boolean }) {
  const [u] = await db.insert(schema.users).values({
    email: o.email, name: o.name ?? 'Test', roleId: o.roleId, isActive: o.isActive ?? true, isEmailVerified: true,
    password: o.password ? await bcrypt.hash(o.password, 4) : null, createdAt: new Date(), updatedAt: new Date(),
  }).returning();
  return u!;
}

import { signToken } from '../../src/lib/jwt.js';
export const bearer = async (email: string) => ({
  authorization: `Bearer ${await signToken(email, { secret: testEnv.JWT_SECRET, expirationMs: 3_600_000 })}`,
});
