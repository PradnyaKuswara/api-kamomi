import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { idParam } from '../../lib/validation.js';
import { userCreateBody, userUpdateBody } from './user.schema.js';
import { UserController } from './user.controller.js';
import { UserRepository } from './user.repository.js';
import { UserService } from './user.service.js';

export async function userRoutes(app: FastifyInstance) {
  const c = new UserController(app, new UserService(new UserRepository(app.db)));
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/api/users', c.getAll);
  r.get('/api/users/paginate', c.getPage);
  r.get('/api/users/:id', { schema: { params: idParam } }, c.getById);
  r.post('/api/users', { schema: { body: userCreateBody } }, c.create);
  r.put('/api/users/:id', { schema: { params: idParam, body: userUpdateBody } }, c.update);
  r.delete('/api/users/:id', { schema: { params: idParam } }, c.remove);
}
