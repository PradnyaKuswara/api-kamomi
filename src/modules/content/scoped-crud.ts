import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AccessGuard } from '../properties/access.js';
import { ONLY_ADMIN } from '../users/authz.js';
import { ScopedCrudController } from './scoped-crud.controller.js';
import { ScopedCrudRepository } from './scoped-crud.repository.js';
import { ScopedCrudService } from './scoped-crud.service.js';
import type { ScopedCrudConfig, ScopedTable } from './scoped-crud.types.js';

export type { ScopedCrudConfig, ScopedTable } from './scoped-crud.types.js';

/** Merakit Repository -> Service -> Controller untuk satu entitas, lalu mendaftarkan 4 route CRUD-nya. */
export function registerScopedCrud<TTable extends ScopedTable, TBody>(app: FastifyInstance, cfg: ScopedCrudConfig<TTable, TBody>) {
  const c = cfg as unknown as ScopedCrudConfig<ScopedTable, TBody>;
  const controller = new ScopedCrudController(
    app,
    new ScopedCrudService(new ScopedCrudRepository(app.db, c.table, c.writeLog), new AccessGuard(app.db), c),
    c,
  );

  const r = app.withTypeProvider<ZodTypeProvider>();
  const base = `/api/properties/:propertyId/${cfg.path}`;
  const pid = z.object({ propertyId: z.coerce.number().int().positive() });
  const pidId = pid.extend({ itemId: z.coerce.number().int().positive() });

  r.get(base, { schema: { params: pid } }, controller.list);
  r.post(base, { schema: { params: pid, body: cfg.body } }, controller.create as never);
  r.put(`${base}/:itemId`, { schema: { params: pidId, body: cfg.body } }, controller.update as never);
  r.delete(`${base}/:itemId`, { schema: { params: pidId } }, controller.remove);
}

export { ONLY_ADMIN };
