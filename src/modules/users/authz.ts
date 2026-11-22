import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { roles, users } from '../../db/schema/index.js';
import { ForbiddenError, NotFoundError } from '../../errors/app-error.js';

export type RoleName = 'ADMIN' | 'USER' | 'SUPER_ADMIN';
export interface AuthUser { id: number; email: string; roleName: string }

/**
 * Setara UserService.authorize*(principal): user harus ada, aktif, dan memiliki salah satu role.
 * Pesan error disamakan dengan versi Java (404 bila user tidak ada, 403 bila nonaktif / role salah).
 */
export async function authorize(app: FastifyInstance, email: string | undefined, allowed: RoleName[]): Promise<AuthUser> {
  const denied = 'Not authorized to access this resource';
  if (!email) throw new NotFoundError(denied);
  const [row] = await app.db.select({ id: users.id, email: users.email, isActive: users.isActive, roleName: roles.name })
    .from(users).leftJoin(roles, eq(users.roleId, roles.id)).where(eq(users.email, email)).limit(1);
  if (!row) throw new NotFoundError(denied);
  if (row.isActive === false) throw new ForbiddenError('User account is inactive');
  const role = (row.roleName ?? '').toUpperCase();
  if (!allowed.some((a) => a === role)) throw new ForbiddenError(denied);
  return { id: row.id, email: row.email, roleName: role };
}

export const ADMIN_OR_SUPER: RoleName[] = ['ADMIN', 'SUPER_ADMIN'];
export const ADMIN_AND_USER: RoleName[] = ['ADMIN', 'USER'];
export const ONLY_ADMIN: RoleName[] = ['ADMIN'];
export const ONLY_SUPER_ADMIN: RoleName[] = ['SUPER_ADMIN'];
