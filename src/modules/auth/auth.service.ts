import { randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../errors/app-error.js';
import { resetPasswordEmail } from '../../lib/email.js';
import { toJsonText } from '../../lib/json-text.js';
import { signToken } from '../../lib/jwt.js';
import { clientIp } from '../../lib/request.js';
import type { PropertyService } from '../properties/property.service.js';
import type { AuthRepository, UserRow } from './auth.repository.js';

const BCRYPT_ROUNDS = 10; // sama dengan default BCryptPasswordEncoder
const now = () => new Date();

export class AuthService {
  constructor(
    private readonly app: FastifyInstance,
    private readonly repo: AuthRepository,
    private readonly properties: PropertyService,
  ) {}

  private token(email: string) {
    return signToken(email, { secret: this.app.env.JWT_SECRET, expirationMs: this.app.env.JWT_EXPIRATION });
  }

  private async logActivity(repo: AuthRepository, userId: number, type: string, token: string | null, req: FastifyRequest) {
    await repo.insertActivity({
      userId,
      activityType: type,
      loginAt: now(),
      ipAddress: clientIp(req),
      userAgent: req.headers['user-agent'] ?? null,
      sessionToken: token,
    });
  }

  private async assignFreePlan(repo: AuthRepository, user: UserRow) {
    const free = await repo.findPlanByName('Free');
    if (!free) return;
    const start = now();
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 100); // Lifetime free
    await repo.insertSubscription({
      userId: user.id, planId: free.id, status: 'ACTIVE', startDate: start, endDate: end,
      createdAt: start, updatedAt: start, createdBy: user.id, updatedBy: user.id,
    });
  }

  private async defaultRoleId(repo: AuthRepository): Promise<number> {
    const id = await repo.findRoleIdByName('ADMIN');
    if (id === undefined) throw new Error('Default Role ADMIN not found');
    return id;
  }

  async register(body: { name: string; email: string; password: string; phoneNumber?: string | null }, req: FastifyRequest) {
    const password = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    return this.repo.transaction(async (tx) => {
      if (await tx.findByEmail(body.email)) {
        throw new BadRequestError('Email already registered', 'Email already registered');
      }
      const user = await tx.insertUser({
        email: body.email, name: body.name, password, phoneNumber: body.phoneNumber ?? null,
        oauthProvider: 'LOCAL', isActive: true, isEmailVerified: true,
        createdAt: now(), updatedAt: now(), roleId: await this.defaultRoleId(tx),
      });
      if (!user) throw new Error('Failed to create user');
      await this.assignFreePlan(tx, user);
      const token = await this.token(user.email);
      await this.logActivity(tx, user.id, 'LOGIN', token, req);
      return { token, email: user.email, name: user.name };
    });
  }

  async login(body: { email: string; password: string }, req: FastifyRequest) {
    const user = await this.repo.findByEmail(body.email);
    // Verifikasi tetap dijalankan walau user tidak ada agar waktu respons tidak membocorkan keberadaan email.
    const ok = await bcrypt.compare(body.password, user?.password ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
    if (!user || !user.password || !ok) throw new UnauthorizedError('Invalid email or password');
    if (user.isActive === false) throw new ForbiddenError('User account is inactive');
    const token = await this.token(user.email);
    await this.logActivity(this.repo, user.id, 'LOGIN', token, req);
    return { token, email: user.email, name: user.name };
  }

  async processOAuthLogin(
    profile: { email: string; name: string | null; picture: string | null; sub: string },
    req: FastifyRequest,
  ): Promise<string> {
    return this.repo.transaction(async (tx) => {
      const system = await tx.findById(1);
      const systemId = system?.id ?? null;
      const existing = await tx.findByEmail(profile.email);
      let user: UserRow;
      if (!existing) {
        const created = await tx.insertUser({
          email: profile.email, name: profile.name ?? profile.email, avatarUrl: profile.picture,
          oauthProvider: 'GOOGLE', oauthId: profile.sub, isActive: true, isEmailVerified: true,
          createdAt: now(), updatedAt: now(), createdBy: systemId, updatedBy: systemId,
          roleId: await this.defaultRoleId(tx),
        });
        if (!created) throw new Error('Failed to create user');
        user = created;
        await this.assignFreePlan(tx, user);
      } else {
        if (existing.isActive === false) throw new ForbiddenError('User account is inactive');
        const updated = await tx.updateUser(existing.id, {
          name: profile.name ?? existing.name, avatarUrl: profile.picture, oauthProvider: 'GOOGLE',
          oauthId: profile.sub, updatedAt: now(), updatedBy: systemId,
        });
        user = updated ?? existing;
        if (!(await tx.hasSubscription(user.id))) await this.assignFreePlan(tx, user);
      }
      const token = await this.token(user.email);
      await this.logActivity(tx, user.id, 'LOGIN', token, req);
      return token;
    });
  }

  async logout(email: string, req: FastifyRequest) {
    const user = await this.repo.findByEmail(email);
    if (!user) throw new NotFoundError('User not found');
    await this.repo.transaction(async (tx) => {
      const active = await tx.findOpenLogin(user.id);
      if (active) await tx.closeActivity(active.id, now());
      await tx.insertActivity({
        userId: user.id, activityType: 'LOGOUT', loginAt: now(), logoutAt: now(),
        ipAddress: clientIp(req), userAgent: req.headers['user-agent'] ?? null,
      });
    });
  }

  async getCurrentUser(email: string) {
    const row = await this.repo.findWithRoleByEmail(email);
    if (!row) throw new NotFoundError('User not found');
    const { user } = row;
    if (user.isActive === false) throw new ForbiddenError('User account is inactive');

    const sub = await this.repo.findActiveSubscription(user.id);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      roleName: row.roleName,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      subscription: sub && {
        id: sub.sub.id, status: sub.sub.status, startDate: sub.sub.startDate, endDate: sub.sub.endDate,
        plan: sub.plan && {
          name: sub.plan.name, price: sub.plan.price, description: sub.plan.description,
          maxRooms: sub.plan.maxRooms, billingCycle: sub.plan.billingCycle, features: toJsonText(sub.plan.features),
        },
      },
      properties: await this.properties.listForUser(user.id),
    };
  }

  async forgotPassword(email: string) {
    const user = await this.repo.findByEmail(email);
    if (!user) return; // jangan bocorkan apakah email terdaftar
    const token = String(randomInt(100000, 1000000)); // 6 digit, CSPRNG (Java memakai java.util.Random)
    await this.repo.updateUser(user.id, {
      passwordResetToken: token, passwordResetExpiresAt: new Date(Date.now() + 15 * 60_000),
    });
    const mail = resetPasswordEmail(user.name, token);
    await this.app.mailer.sendHtml(user.email, mail.subject, mail.html);
  }

  async resetPassword(token: string, newPassword: string) {
    const invalid = () => new BadRequestError('Kode reset password tidak valid atau sudah kadaluarsa', 'Kode reset password tidak valid atau sudah kadaluarsa');
    const user = await this.repo.findByResetToken(token);
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < now()) throw invalid();
    await this.repo.updateUser(user.id, {
      password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      passwordResetToken: null, passwordResetExpiresAt: null, updatedAt: now(),
    });
  }
}
