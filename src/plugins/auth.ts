import fp from 'fastify-plugin';
import { verifyToken } from '../lib/jwt.js';
import { UnauthorizedError } from '../errors/app-error.js';

/** Sama dengan permitAll() di SecurityConfig versi Java. */
const PUBLIC_PREFIXES = ['/api/auth/', '/login/', '/oauth2/', '/api/faqs', '/api/public/'];
const PUBLIC_EXACT = new Set(['/api/subscription-plans/active', '/api/auth']);

export const isPublicPath = (path: string) =>
  PUBLIC_EXACT.has(path) || PUBLIC_PREFIXES.some((p) => path === p.replace(/\/$/, '') || path.startsWith(p));

function extractToken(header: string | undefined, query: unknown): string | null {
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  // Fallback ?token= (dipakai EventSource/SSE yang tidak bisa set header)
  const q = (query as Record<string, unknown> | undefined)?.token;
  return typeof q === 'string' && q ? q : null;
}

export default fp(async (app) => {
  app.addHook('onRequest', async (req) => {
    if (req.method === 'OPTIONS') return;
    const token = extractToken(req.headers.authorization, req.query);
    if (token) {
      const email = await verifyToken(token, app.env.JWT_SECRET);
      if (email) req.userEmail = email;
    }
    const path = req.url.split('?')[0] ?? '';
    if (!req.userEmail && !isPublicPath(path)) throw new UnauthorizedError('Unauthorized');
  });
}, { name: 'auth' });
