import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { RoomRepository } from '../rooms/room.repository.js';
import { SubscriptionPolicy } from '../subscriptions/subscription-policy.js';
import { AccessGuard } from './access.js';
import { PropertyRepository } from './property.repository.js';
import { UserAccessController } from './user-access.controller.js';
import { UserAccessRepository } from './user-access.repository.js';
import { UserAccessService } from './user-access.service.js';

const pid = z.object({ propertyId: z.coerce.number().int().positive() });
const assignBody = z.object({ userId: z.number({ error: 'User ID is required' }).int(), roomIds: z.array(z.number().int()).nullish() });

export async function userAccessRoutes(app: FastifyInstance) {
  const service = new UserAccessService(
    new UserAccessRepository(app.db), new RoomRepository(app.db), new PropertyRepository(app.db),
    new AccessGuard(app.db), new SubscriptionPolicy(app.db),
  );
  const c = new UserAccessController(app, service);
  const r = app.withTypeProvider<ZodTypeProvider>();
  const base = '/api/properties/:propertyId/user-access';

  r.get(base, { schema: { params: pid } }, c.list);
  r.post(base, { schema: { params: pid, body: assignBody } }, c.assign);
  r.delete(`${base}/:userId`, { schema: { params: pid.extend({ userId: z.coerce.number().int().positive() }) } }, c.remove);
}
