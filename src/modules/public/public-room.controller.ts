import type { FastifyRequest } from 'fastify';
import { AppError } from '../../errors/app-error.js';
import { fail, ok } from '../../lib/api-response.js';
import type { PublicRoomService } from './public-room.service.js';

export class PublicRoomController {
  constructor(private readonly service: PublicRoomService) {}

  // Seperti versi Java: error dibungkus envelope dengan HTTP 200 (400 untuk kode tidak valid, 500 untuk lainnya).
  getByCode = async (req: FastifyRequest<{ Params: { code: string } }>) => {
    try {
      return ok('Successfully retrieved public room details', await this.service.getByCode(req.params.code));
    } catch (e) {
      if (e instanceof AppError) return fail(e.statusCode === 400 ? 400 : 500, e.message);
      req.log.error({ err: e }, 'public room failed');
      return fail(500, 'Internal Server Error');
    }
  };
}
