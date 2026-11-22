import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ok } from '../../lib/api-response.js';
import { parsePageable, toPage } from '../../lib/pagination.js';
import type { NotificationService } from './notification.service.js';

type IdReq = FastifyRequest<{ Params: { id: number } }>;

export class NotificationController {
  constructor(private readonly app: FastifyInstance, private readonly service: NotificationService) {}

  list = async (req: FastifyRequest) => {
    const q = parsePageable(req.query);
    const { rows, total } = await this.service.list(await this.service.resolveUserId(req.userEmail), q.page, q.size);
    return ok('Berhasil mengambil daftar notifikasi', toPage(rows, total, { ...q, sort: [] }));
  };

  unreadCount = async (req: FastifyRequest) =>
    ok('Jumlah notifikasi belum dibaca', await this.service.unreadCount(await this.service.resolveUserId(req.userEmail)));

  stream = async (req: FastifyRequest, reply: FastifyReply) => {
    this.app.sse.subscribe(await this.service.resolveUserId(req.userEmail), reply);
  };

  markAllRead = async (req: FastifyRequest) => {
    await this.service.markAllRead(await this.service.resolveUserId(req.userEmail));
    return ok('Semua notifikasi ditandai telah dibaca');
  };

  markRead = async (req: IdReq) =>
    ok('Notifikasi ditandai telah dibaca', await this.service.markRead(await this.service.resolveUserId(req.userEmail), req.params.id));

  remove = async (req: IdReq) => {
    await this.service.remove(await this.service.resolveUserId(req.userEmail), req.params.id);
    return ok('Notifikasi berhasil dihapus');
  };
}
