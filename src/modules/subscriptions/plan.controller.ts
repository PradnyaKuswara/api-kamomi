import type { FastifyInstance, FastifyRequest } from 'fastify';
import { created, ok } from '../../lib/api-response.js';
import { parsePageable } from '../../lib/pagination.js';
import { ONLY_SUPER_ADMIN, authorize } from '../users/authz.js';
import type { PlanInput, PlanService } from './plan.service.js';

type IdReq = FastifyRequest<{ Params: { id: number } }>;

export class PlanController {
  constructor(private readonly app: FastifyInstance, private readonly service: PlanService) {}

  private guard(req: FastifyRequest) { return authorize(this.app, req.userEmail, ONLY_SUPER_ADMIN); }

  listActive = async () => ok('Successfully retrieved active subscription plans', await this.service.listActive());

  listAll = async (req: FastifyRequest) => {
    await this.guard(req);
    return ok('Successfully retrieved', await this.service.listAll());
  };

  page = async (req: FastifyRequest) => {
    await this.guard(req);
    return ok('Successfully retrieved', await this.service.page(parsePageable(req.query)));
  };

  get = async (req: IdReq) => {
    await this.guard(req);
    return ok('Successfully retrieved', await this.service.get(req.params.id));
  };

  create = async (req: FastifyRequest<{ Body: PlanInput }>) => {
    const me = await this.guard(req);
    return created('Successfully created', await this.service.create(req.body, me.id));
  };

  update = async (req: FastifyRequest<{ Params: { id: number }; Body: PlanInput }>) => {
    const me = await this.guard(req);
    return ok('Successfully updated', await this.service.update(req.params.id, req.body, me.id));
  };

  remove = async (req: IdReq) => {
    await this.guard(req);
    await this.service.remove(req.params.id);
    return ok('Successfully deleted');
  };
}
