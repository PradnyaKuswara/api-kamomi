import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../../errors/app-error.js';
import { created, fail, ok } from '../../lib/api-response.js';
import { parsePageable } from '../../lib/pagination.js';
import { clientIp } from '../../lib/request.js';
import type { AccessGuard } from '../properties/access.js';
import { ADMIN_AND_USER, authorize } from '../users/authz.js';
import type { ComplaintService, PublicComplaintInput, UpdateStatusInput } from './complaint.service.js';

type PropertyReq = FastifyRequest<{ Params: { propertyId: number } }>;
type ComplaintReq = FastifyRequest<{ Params: { propertyId: number; complaintId: number } }>;

export class ComplaintController {
  constructor(
    private readonly app: FastifyInstance,
    private readonly service: ComplaintService,
    private readonly access: AccessGuard,
  ) {}

  private async authorizeProperty(req: FastifyRequest, propertyId: number) {
    const me = await authorize(this.app, req.userEmail, ADMIN_AND_USER);
    await this.access.property(me, propertyId);
  }

  list = async (req: PropertyReq) => {
    await this.authorizeProperty(req, req.params.propertyId);
    const status = (req.query as { status?: string }).status;
    return ok('Successfully retrieved complaints', await this.service.list(req.params.propertyId, status, parsePageable(req.query)));
  };

  updateStatus = async (req: FastifyRequest<{ Params: { propertyId: number; complaintId: number }; Body: UpdateStatusInput }>) => {
    await this.authorizeProperty(req, req.params.propertyId);
    return ok('Successfully updated complaint status',
      await this.service.updateStatus(req.params.propertyId, req.params.complaintId, req.body));
  };

  remove = async (req: ComplaintReq) => {
    await this.authorizeProperty(req, req.params.propertyId);
    await this.service.remove(req.params.propertyId, req.params.complaintId);
    return ok('Successfully deleted complaint');
  };

  // Publik (tamu memindai QR). Versi Java membungkus semua error ke envelope dengan HTTP 200:
  // IllegalArgument -> code 400, lainnya (termasuk "tidak ditemukan") -> code 500.
  createPublic = async (req: FastifyRequest<{ Body: PublicComplaintInput }>) => {
    try {
      return created('Keluhan berhasil dikirim ke pengelola',
        await this.service.createPublic(req.body, clientIp(req), req.headers['user-agent'] ?? null));
    } catch (e) {
      if (e instanceof AppError) return fail(e.statusCode === 400 ? 400 : 500, e.message);
      req.log.error({ err: e }, 'public complaint failed');
      return fail(500, 'Internal Server Error');
    }
  };
}
