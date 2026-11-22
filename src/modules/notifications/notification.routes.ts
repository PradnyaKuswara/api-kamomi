import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { idParam } from '../../lib/validation.js';
import { NotificationController } from './notification.controller.js';
import { NotificationRepository } from './notification.repository.js';
import { NotificationService } from './notification.service.js';

async function routes(app: FastifyInstance) {
  const service = new NotificationService(new NotificationRepository(app.db));
  app.decorate('notifications', service);
  const c = new NotificationController(app, service);
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/api/notifications', c.list);
  r.get('/api/notifications/unread-count', c.unreadCount);
  r.get('/api/notifications/stream', c.stream);
  // 'read-all' statis menang atas rute parametrik '/:id/read'.
  r.put('/api/notifications/read-all', c.markAllRead);
  r.put('/api/notifications/:id/read', { schema: { params: idParam } }, c.markRead);
  r.delete('/api/notifications/:id', { schema: { params: idParam } }, c.remove);
}

// fp: agar dekorator `notifications` terlihat oleh modul lain (mis. complaints).
export const notificationRoutes = fp(routes, { name: 'notifications' });
