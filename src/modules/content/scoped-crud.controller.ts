import type { FastifyInstance, FastifyRequest } from 'fastify';
import { created, ok } from '../../lib/api-response.js';
import { parsePageable } from '../../lib/pagination.js';
import { ADMIN_AND_USER, authorize } from '../users/authz.js';
import type { ScopedCrudService } from './scoped-crud.service.js';
import type { ScopedCrudConfig, ScopedTable } from './scoped-crud.types.js';

type PReq<B = unknown> = FastifyRequest<{ Params: { propertyId: number }; Body: B }>;
type IReq<B = unknown> = FastifyRequest<{ Params: { propertyId: number; itemId: number }; Body: B }>;

export class ScopedCrudController<TBody> {
  constructor(
    private readonly app: FastifyInstance,
    private readonly service: ScopedCrudService<TBody>,
    private readonly cfg: Pick<ScopedCrudConfig<ScopedTable, TBody>, 'messages' | 'deleteRoles'>,
  ) {}

  private any(req: FastifyRequest) { return authorize(this.app, req.userEmail, ADMIN_AND_USER); }

  list = async (req: PReq) => {
    const me = await this.any(req);
    return ok(this.cfg.messages.list, await this.service.list(me, req.params.propertyId, parsePageable(req.query)));
  };

  create = async (req: PReq<TBody>) => {
    const me = await this.any(req);
    return created(this.cfg.messages.create, await this.service.create(me, req.params.propertyId, req.body as TBody));
  };

  update = async (req: IReq<TBody>) => {
    const me = await this.any(req);
    return ok(this.cfg.messages.update, await this.service.update(me, req.params.propertyId, req.params.itemId, req.body as TBody));
  };

  remove = async (req: IReq) => {
    const me = await authorize(this.app, req.userEmail, this.cfg.deleteRoles ?? ADMIN_AND_USER);
    await this.service.remove(me, req.params.propertyId, req.params.itemId);
    return ok(this.cfg.messages.delete);
  };
}
