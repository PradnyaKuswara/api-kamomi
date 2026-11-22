import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { idParam, notBlank } from '../../lib/validation.js';
import { PlanController } from './plan.controller.js';
import { PlanRepository } from './plan.repository.js';
import { PlanService } from './plan.service.js';

// Body Java adalah entity: `features` dikirim sebagai teks JSON; objek langsung juga diterima.
const planBody = z.object({
  name: notBlank('Name is required').pipe(z.string().max(100, 'Name must not exceed 100 characters')),
  price: z.number({ error: 'Price is required' }).nonnegative(),
  description: z.string().nullish(),
  maxRooms: z.number().int().nullish(),
  billingCycle: z.string().nullish(),
  features: z.union([z.string(), z.record(z.string(), z.unknown()), z.array(z.unknown())]).nullish(),
  isActive: z.boolean().nullish(),
});

export async function planRoutes(app: FastifyInstance) {
  const c = new PlanController(app, new PlanService(new PlanRepository(app.db)));
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/api/subscription-plans/active', c.listActive);
  r.get('/api/subscription-plans', c.listAll);
  r.get('/api/subscription-plans/paginate', c.page);
  r.get('/api/subscription-plans/:id', { schema: { params: idParam } }, c.get);
  r.post('/api/subscription-plans', { schema: { body: planBody } }, c.create);
  r.put('/api/subscription-plans/:id', { schema: { params: idParam, body: planBody } }, c.update);
  r.delete('/api/subscription-plans/:id', { schema: { params: idParam } }, c.remove);
}
