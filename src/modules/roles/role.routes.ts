import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { idParam, notBlank } from '../../lib/validation.js';
import { RoleController } from './role.controller.js';
import { RoleRepository } from './role.repository.js';
import { RoleService } from './role.service.js';

const body = z.object({ name: notBlank('Name is required') });

export async function roleRoutes(app: FastifyInstance) {
  const c = new RoleController(app, new RoleService(new RoleRepository(app.db)));
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/api/roles', c.list);
  r.get('/api/roles/:id', { schema: { params: idParam } }, c.get);
  r.post('/api/roles', { schema: { body } }, c.create);
  r.put('/api/roles/:id', { schema: { params: idParam, body } }, c.update);
  r.delete('/api/roles/:id', { schema: { params: idParam } }, c.remove);
}
