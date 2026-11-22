import type { FastifyInstance, FastifyRequest } from 'fastify';
import { created, ok } from '../../lib/api-response.js';
import { ADMIN_OR_SUPER, authorize } from '../users/authz.js';
import type { RoleService } from './role.service.js';

type IdReq = FastifyRequest<{ Params: { id: number } }>;

export class RoleController {
  constructor(private readonly app: FastifyInstance, private readonly service: RoleService) {}

  // Versi Java tidak memeriksa role sama sekali di endpoint ini (siapa pun yang login bisa CRUD role).
  // Di sini dibatasi ADMIN/SUPER_ADMIN — frontend admin tidak terpengaruh.
  private guard(req: FastifyRequest) { return authorize(this.app, req.userEmail, ADMIN_OR_SUPER); }

  list = async (req: FastifyRequest) => {
    await this.guard(req);
    return ok('Berhasil mengambil semua data role', await this.service.list());
  };

  get = async (req: IdReq) => {
    await this.guard(req);
    return ok(`Berhasil mengambil data role ID ${req.params.id}`, await this.service.get(req.params.id));
  };

  create = async (req: FastifyRequest<{ Body: { name: string } }>) => {
    await this.guard(req);
    return created('Berhasil membuat role baru', await this.service.create(req.body.name));
  };

  update = async (req: FastifyRequest<{ Params: { id: number }; Body: { name: string } }>) => {
    await this.guard(req);
    return ok(`Berhasil memperbarui data role ID ${req.params.id}`, await this.service.update(req.params.id, req.body.name));
  };

  remove = async (req: IdReq) => {
    await this.guard(req);
    await this.service.remove(req.params.id);
    return ok(`Berhasil menghapus data role ID ${req.params.id}`);
  };
}
