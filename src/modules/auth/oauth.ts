import { randomBytes, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import type { FastifyInstance } from 'fastify';
import type { AuthService } from './auth.service.js';

const COOKIE = 'oauth_state';

const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Pengganti spring-boot-starter-oauth2-client:
 *   GET /oauth2/authorization/google       -> redirect ke Google
 *   GET /login/oauth2/code/google          -> tukar code, login, redirect ke FE dengan ?token=
 * State disimpan di cookie httpOnly (proteksi CSRF login).
 */
export async function oauthRoutes(app: FastifyInstance, auth: AuthService) {
  const { env } = app;
  const client = () => new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
  const failTo = (reason: string) => `${env.FRONTEND_URL}/login?error=${encodeURIComponent(reason)}`;

  app.get('/oauth2/authorization/google', async (_req, reply) => {
    const state = randomBytes(24).toString('base64url');
    reply.setCookie(COOKIE, state, {
      httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', path: '/', maxAge: 600,
    });
    const url = client().generateAuthUrl({ scope: ['openid', 'email', 'profile'], state, access_type: 'online' });
    return reply.redirect(url);
  });

  app.get('/login/oauth2/code/google', async (req, reply) => {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    const expected = req.cookies[COOKIE];
    reply.clearCookie(COOKIE, { path: '/' });
    if (error || !code || !state || !expected || !safeEq(state, expected)) return reply.redirect(failTo('oauth'));

    try {
      const c = client();
      const { tokens } = await c.getToken(code);
      if (!tokens.id_token) return reply.redirect(failTo('oauth'));
      const ticket = await c.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID });
      const p = ticket.getPayload();
      if (!p?.email || !p.sub || p.email_verified === false) return reply.redirect(failTo('oauth'));
      const token = await auth.processOAuthLogin(
        { email: p.email, name: p.name ?? null, picture: p.picture ?? null, sub: p.sub }, req,
      );
      return reply.redirect(`${env.FRONTEND_URL}/oauth2/redirect?token=${encodeURIComponent(token)}`);
    } catch (err) {
      req.log.warn({ err }, 'oauth login failed');
      return reply.redirect(failTo('oauth'));
    }
  });
}
