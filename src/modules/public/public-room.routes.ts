import type { FastifyInstance } from 'fastify';
import { SubscriptionPolicy } from '../subscriptions/subscription-policy.js';
import { PublicRoomController } from './public-room.controller.js';
import { PublicRoomRepository } from './public-room.repository.js';
import { PublicRoomService } from './public-room.service.js';

export async function publicRoomRoutes(app: FastifyInstance) {
  const c = new PublicRoomController(new PublicRoomService(new PublicRoomRepository(app.db), new SubscriptionPolicy(app.db)));
  app.get('/api/public/rooms/:code', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, c.getByCode);
}
