import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AccessGuard } from '../properties/access.js';
import { SubscriptionPolicy } from '../subscriptions/subscription-policy.js';
import { ComplaintController } from './complaint.controller.js';
import { ComplaintRepository } from './complaint.repository.js';
import { ComplaintService } from './complaint.service.js';

const pid = z.object({ propertyId: z.coerce.number().int().positive() });
const pidCid = pid.extend({ complaintId: z.coerce.number().int().positive() });
const publicBody = z.object({
  roomCode: z.string().nullish(), category: z.string().nullish(), description: z.string().nullish(),
  guestName: z.string().nullish(), guestContact: z.string().nullish(),
});
const statusBody = z.object({ status: z.string().nullish(), responseNote: z.string().nullish() });

export async function complaintRoutes(app: FastifyInstance) {
  const service = new ComplaintService(app, new ComplaintRepository(app.db), new SubscriptionPolicy(app.db));
  const controller = new ComplaintController(app, service, new AccessGuard(app.db));
  const r = app.withTypeProvider<ZodTypeProvider>();
  const base = '/api/properties/:propertyId/complaints';

  r.get(base, { schema: { params: pid } }, controller.list);
  r.put(`${base}/:complaintId/status`, { schema: { params: pidCid, body: statusBody } }, controller.updateStatus);
  r.delete(`${base}/:complaintId`, { schema: { params: pidCid } }, controller.remove);
  r.post('/api/public/complaints', {
    schema: { body: publicBody },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, controller.createPublic);
}
