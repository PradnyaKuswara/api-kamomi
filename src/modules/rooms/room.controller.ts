import type { FastifyInstance, FastifyRequest } from 'fastify';
import { created, ok } from '../../lib/api-response.js';
import { parsePageable } from '../../lib/pagination.js';
import { ADMIN_AND_USER, ONLY_ADMIN, authorize } from '../users/authz.js';
import type { RoomInput, RoomService } from './room.service.js';

type PReq = FastifyRequest<{ Params: { propertyId: number } }>;
type RReq = FastifyRequest<{ Params: { propertyId: number; roomId: number } }>;
type BodyReq = FastifyRequest<{ Params: { propertyId: number; roomId: number }; Body: RoomInput }>;

export class RoomController {
  constructor(private readonly app: FastifyInstance, private readonly service: RoomService) {}

  private any(req: FastifyRequest) { return authorize(this.app, req.userEmail, ADMIN_AND_USER); }
  private admin(req: FastifyRequest) { return authorize(this.app, req.userEmail, ONLY_ADMIN); }

  list = async (req: PReq) => {
    const me = await this.any(req);
    return ok('Successfully retrieved rooms', await this.service.list(req.params.propertyId, me, parsePageable(req.query)));
  };

  logsByProperty = async (req: PReq) => {
    const me = await this.any(req);
    return ok('Successfully retrieved room logs', await this.service.logsByProperty(req.params.propertyId, me));
  };

  get = async (req: RReq) => {
    const me = await this.any(req);
    return ok('Successfully retrieved room', await this.service.get(req.params.roomId, me));
  };

  create = async (req: FastifyRequest<{ Params: { propertyId: number }; Body: RoomInput }>) => {
    const me = await this.admin(req);
    return created('Successfully created room', await this.service.create(req.params.propertyId, req.body, me));
  };

  update = async (req: BodyReq) => {
    const me = await this.any(req);
    return ok('Successfully updated room', await this.service.update(req.params.roomId, req.body, me));
  };

  remove = async (req: RReq) => {
    const me = await this.admin(req);
    await this.service.remove(req.params.roomId, me);
    return ok('Successfully deleted room');
  };

  logsByRoom = async (req: RReq) => {
    const me = await this.any(req);
    return ok(`Successfully retrieved room logs for room ID ${req.params.roomId}`, await this.service.logsByRoom(req.params.roomId, me));
  };
}
