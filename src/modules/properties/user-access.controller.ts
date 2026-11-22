import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ok } from '../../lib/api-response.js';
import { parsePageable } from '../../lib/pagination.js';
import { ONLY_ADMIN, authorize } from '../users/authz.js';
import type { UserAccessService } from './user-access.service.js';

export class UserAccessController {
  constructor(private readonly app: FastifyInstance, private readonly service: UserAccessService) {}

  private admin(req: FastifyRequest) { return authorize(this.app, req.userEmail, ONLY_ADMIN); }

  list = async (req: FastifyRequest<{ Params: { propertyId: number } }>) => {
    const me = await this.admin(req);
    return ok('Successfully retrieved property user room assignments', await this.service.list(req.params.propertyId, me, parsePageable(req.query)));
  };

  assign = async (req: FastifyRequest<{ Params: { propertyId: number }; Body: { userId: number; roomIds?: number[] | null } }>) => {
    const me = await this.admin(req);
    return ok('Successfully assigned user room access',
      await this.service.assign(req.params.propertyId, me, req.body.userId, req.body.roomIds));
  };

  remove = async (req: FastifyRequest<{ Params: { propertyId: number; userId: number } }>) => {
    const me = await this.admin(req);
    await this.service.remove(req.params.propertyId, me, req.params.userId);
    return ok('Successfully removed user access for this property');
  };
}
