import type { Db } from '../db/client.js';
import type { Env } from '../config/env.js';
import type { Mailer } from '../lib/email.js';
import type { SseHub } from '../modules/notifications/sse.js';
import type { NotificationService } from '../modules/notifications/notification.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    env: Env;
    mailer: Mailer;
    sse: SseHub;
    notifications: NotificationService;
  }
  interface FastifyRequest {
    /** Email dari JWT (setara Principal.getName() di Spring); undefined bila belum login. */
    userEmail?: string;
  }
}
