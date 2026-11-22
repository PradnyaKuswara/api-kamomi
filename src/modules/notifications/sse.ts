import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ServerResponse } from 'node:http';

const TIMEOUT_MS = 30 * 60 * 1000; // sama dengan SseEmitter(30 menit)
const HEARTBEAT_MS = 20_000;

/** Pengganti NotificationSseService: satu user bisa punya banyak koneksi (tab). */
export class SseHub {
  private readonly clients = new Map<number, Set<ServerResponse>>();
  private timer: NodeJS.Timeout;

  constructor() {
    this.timer = setInterval(() => this.broadcastRaw(': ping\n\n'), HEARTBEAT_MS);
    this.timer.unref();
  }

  private static frame(event: string, data: unknown) {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    return `event: ${event}\n${body.split('\n').map((l) => `data: ${l}`).join('\n')}\n\n`;
  }

  private drop(userId: number, res: ServerResponse) {
    const set = this.clients.get(userId);
    set?.delete(res);
    if (set?.size === 0) this.clients.delete(userId);
  }

  private write(userId: number, res: ServerResponse, chunk: string) {
    try {
      if (res.writableEnded || res.destroyed) return this.drop(userId, res);
      res.write(chunk);
    } catch { this.drop(userId, res); }
  }

  private broadcastRaw(chunk: string) {
    for (const [userId, set] of this.clients) for (const res of [...set]) this.write(userId, res, chunk);
  }

  /** Mengambil alih response (hijack) dan menjaganya tetap terbuka. */
  subscribe(userId: number, reply: FastifyReply) {
    reply.hijack();
    const res = reply.raw;
    // hijack melewati hook onSend, jadi header CORS yang sudah diset @fastify/cors disalin manual.
    res.writeHead(200, {
      ...reply.getHeaders() as Record<string, string>,
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
    });
    let set = this.clients.get(userId);
    if (!set) this.clients.set(userId, (set = new Set()));
    set.add(res);

    const cleanup = () => { clearTimeout(timeout); this.drop(userId, res); };
    const timeout = setTimeout(() => { cleanup(); res.end(); }, TIMEOUT_MS);
    res.on('close', cleanup);
    res.on('error', cleanup);
    res.write(SseHub.frame('INIT', 'Connected to Kamomi Notification Stream'));
  }

  send(userId: number, data: unknown) {
    const set = this.clients.get(userId);
    if (!set) return;
    const chunk = SseHub.frame('NOTIFICATION', data);
    for (const res of [...set]) this.write(userId, res, chunk);
  }

  close() {
    clearInterval(this.timer);
    for (const set of this.clients.values()) for (const res of set) res.end();
    this.clients.clear();
  }
}

export function registerSse(app: FastifyInstance) {
  const hub = new SseHub();
  app.decorate('sse', hub);
  app.addHook('onClose', async () => hub.close());
}
