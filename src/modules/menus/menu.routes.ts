import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { MenuController } from './menu.controller.js';
import { MenuRepository } from './menu.repository.js';
import { MenuService } from './menu.service.js';

const overrideBody = z.object({
  userId: z.number({ error: 'User ID is required' }),
  menuId: z.number({ error: 'Menu ID is required' }),
  isAllowed: z.boolean({ error: 'isAllowed state is required' }),
});

export async function menuRoutes(app: FastifyInstance) {
  const c = new MenuController(app, new MenuService(new MenuRepository(app.db)));
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/api/menus/user/:userId/sidebar', { schema: { params: z.object({ userId: z.coerce.number().int() }) } }, c.userSidebar);
  r.post('/api/menus/user-overrides', { schema: { body: overrideBody } }, c.setOverride);
}
