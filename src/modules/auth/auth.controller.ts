import type { FastifyRequest } from 'fastify';
import { created, fail, ok } from '../../lib/api-response.js';
import type { AuthService } from './auth.service.js';

type Body<T> = FastifyRequest<{ Body: T }>;

export class AuthController {
  constructor(private readonly service: AuthService) {}

  register = async (req: Body<{ name: string; email: string; password: string; phoneNumber?: string | null }>) =>
    created('Registration successful', await this.service.register(req.body, req));

  login = async (req: Body<{ email: string; password: string }>) =>
    ok('Login successful', await this.service.login(req.body, req));

  logout = async (req: FastifyRequest) => {
    if (req.userEmail) await this.service.logout(req.userEmail, req);
    return ok('Logout successful');
  };

  // Versi Java mengembalikan HTTP 200 dengan success=false/code=401 bila tanpa principal.
  me = async (req: FastifyRequest) => {
    if (!req.userEmail) return fail(401, 'Unauthorized');
    return ok('Current user profile retrieved successfully', await this.service.getCurrentUser(req.userEmail));
  };

  forgotPassword = async (req: Body<{ email: string }>) => {
    await this.service.forgotPassword(req.body.email);
    return ok('Jika email terdaftar, instruksi reset password telah dikirim ke email Anda');
  };

  resetPassword = async (req: Body<{ token: string; newPassword: string }>) => {
    await this.service.resetPassword(req.body.token, req.body.newPassword);
    return ok('Password berhasil diperbarui, silakan login dengan password baru');
  };
}
