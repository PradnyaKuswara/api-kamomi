import type { FastifyInstance, FastifyRequest } from 'fastify';
import { created, ok } from '../../lib/api-response.js';
import { parsePageable } from '../../lib/pagination.js';
import { ADMIN_OR_SUPER, authorize } from './authz.js';
import type { UserCreateInput, UserService, UserUpdateInput } from './user.service.js';

type IdReq = FastifyRequest<{ Params: { id: number } }>;

export class UserController {
  constructor(private readonly app: FastifyInstance, private readonly service: UserService) {}

  private guard(req: FastifyRequest) { return authorize(this.app, req.userEmail, ADMIN_OR_SUPER); }

  getAll = async (req: FastifyRequest) => {
    await this.guard(req);
    return ok('Successfully retrieved all users', await this.service.getAll());
  };

  getPage = async (req: FastifyRequest) => {
    await this.guard(req);
    return ok('Successfully retrieved paginated users', await this.service.getPage(parsePageable(req.query)));
  };

  getById = async (req: IdReq) => {
    await this.guard(req);
    return ok('Successfully retrieved user', await this.service.getById(req.params.id));
  };

  create = async (req: FastifyRequest<{ Body: UserCreateInput }>) => {
    await this.guard(req);
    return created('User created successfully', await this.service.create(req.body));
  };

  update = async (req: FastifyRequest<{ Params: { id: number }; Body: UserUpdateInput }>) => {
    await this.guard(req);
    return ok('User updated successfully', await this.service.update(req.params.id, req.body));
  };

  remove = async (req: IdReq) => {
    const me = await this.guard(req);
    await this.service.delete(req.params.id, me.email);
    return ok('User deleted successfully');
  };
}
