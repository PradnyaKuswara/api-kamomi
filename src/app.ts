import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { createDb, type Db } from './db/client.js';
import type { Env } from './config/env.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import auth from './plugins/auth.js';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { fail, ok } from './lib/api-response.js';
import { createMailer, type Mailer } from './lib/email.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { roleRoutes } from './modules/roles/role.routes.js';
import { menuRoutes } from './modules/menus/menu.routes.js';
import { propertyRoutes } from './modules/properties/property.routes.js';
import { userAccessRoutes } from './modules/properties/user-access.routes.js';
import { roomRoutes } from './modules/rooms/room.routes.js';
import { registerSse } from './modules/notifications/sse.js';
import { notificationRoutes } from './modules/notifications/notification.routes.js';
import { complaintRoutes } from './modules/complaints/complaint.routes.js';
import { publicRoomRoutes } from './modules/public/public-room.routes.js';
import { contentRoutes } from './modules/content/content.routes.js';
import { planRoutes } from './modules/subscriptions/plan.routes.js';
import { faqRoutes } from './modules/subscriptions/faq.routes.js';

export interface BuildOptions {
  env: Env;
  /** Untuk test: suntikkan db sendiri. */
  db?: Db;
  /** Untuk test: ganti pengirim email. */
  mailer?: Mailer;
}

export async function buildApp({ env, db, mailer }: BuildOptions): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: env.TRUST_PROXY,
    logger:
      env.NODE_ENV === 'test'
        ? false
        : { level: 'info', transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('env', env);
  if (db) {
    app.decorate('db', db);
  } else {
    const { pool, db: created } = createDb(env);
    app.decorate('db', created);
    app.addHook('onClose', async () => { await pool.end(); });
  }

  registerErrorHandler(app);

  await app.register(helmet);
  await app.register(compress, { threshold: 0 });
  await app.register(cors, {
    origin: [env.FRONTEND_URL],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Cache-Control'],
    credentials: true,
  });
  await app.register(rateLimit, {
    global: false, // hanya route yang memasang config.rateLimit
    allowList: () => !env.RATE_LIMIT,
    errorResponseBuilder: (_req, ctx) => ({ ...fail(429, `Terlalu banyak permintaan. Coba lagi dalam ${Math.ceil(ctx.ttl / 1000)} detik.`), statusCode: 429 }),
  });
  await app.register(cookie);
  await app.register(auth);
  app.decorate('mailer', mailer ?? createMailer(env, app.log));

  app.get('/api/public/health', async () => ok('OK', { status: 'up' }));

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(roleRoutes);
  await app.register(menuRoutes);
  await app.register(propertyRoutes);
  await app.register(userAccessRoutes);
  await app.register(roomRoutes);
  registerSse(app);
  await app.register(notificationRoutes);
  await app.register(contentRoutes);
  await app.register(complaintRoutes);
  await app.register(publicRoomRoutes);
  await app.register(planRoutes);
  await app.register(faqRoutes);

  return app;
}
