import type { FastifyRequest } from 'fastify';

/** Sama dengan getClientIp() di AuthService: X-Forwarded-For pertama, jika tidak ada remote addr. */
export function clientIp(req: FastifyRequest): string {
  const xf = req.headers['x-forwarded-for'];
  const v = Array.isArray(xf) ? xf[0] : xf;
  return v ? (v.split(',')[0] ?? '').trim() : req.ip;
}
