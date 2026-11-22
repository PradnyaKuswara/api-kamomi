import type { FastifyRequest } from 'fastify';
import { created, fail } from '../../lib/api-response.js';
import type { PropertyInput, PropertyService } from './property.service.js';

export class PropertyController {
  constructor(private readonly service: PropertyService) {}

  create = async (req: FastifyRequest<{ Body: PropertyInput }>) => {
    if (!req.userEmail) return fail(401, 'Unauthorized');
    return created('Property created successfully', await this.service.create(req.userEmail, req.body));
  };
}
