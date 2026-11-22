import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { notBlank } from '../../lib/validation.js';
import { PropertyController } from './property.controller.js';
import { PropertyRepository } from './property.repository.js';
import { PropertyService } from './property.service.js';

const body = z.object({
  propertyType: z.string().max(20).nullish(),
  name: notBlank('Name is required').pipe(z.string().max(200, 'Name must not exceed 200 characters')),
  description: z.string().nullish(),
  address: z.string().nullish(),
  city: z.string().max(100, 'City must not exceed 100 characters').nullish(),
  province: z.string().max(100, 'Province must not exceed 100 characters').nullish(),
  postalCode: z.string().max(10, 'Postal code must not exceed 10 characters').nullish(),
});

export async function propertyRoutes(app: FastifyInstance) {
  const c = new PropertyController(new PropertyService(new PropertyRepository(app.db)));
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/api/properties', { schema: { body } }, c.create);
}
