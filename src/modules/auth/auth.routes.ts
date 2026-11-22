import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PropertyRepository } from '../properties/property.repository.js';
import { PropertyService } from '../properties/property.service.js';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { forgotPasswordBody, loginBody, registerBody, resetPasswordBody } from './auth.schema.js';
import { oauthRoutes } from './oauth.js';

export async function authRoutes(app: FastifyInstance) {
  const auth = new AuthService(app, new AuthRepository(app.db), new PropertyService(new PropertyRepository(app.db)));
  const c = new AuthController(auth);
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/api/auth/register', { schema: { body: registerBody }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, c.register);
  r.post('/api/auth/login', { schema: { body: loginBody }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, c.login);
  app.post('/api/auth/logout', c.logout);
  app.get('/api/auth/me', c.me);
  r.post('/api/auth/forgot-password', { schema: { body: forgotPasswordBody }, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, c.forgotPassword);
  r.post('/api/auth/reset-password', { schema: { body: resetPasswordBody }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, c.resetPassword);

  await oauthRoutes(app, auth);
}
