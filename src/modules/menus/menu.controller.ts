import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ForbiddenError } from '../../errors/app-error.js';
import { ok } from '../../lib/api-response.js';
import { ADMIN_OR_SUPER, authorize } from '../users/authz.js';
import type { MenuService } from './menu.service.js';

export class MenuController {
  constructor(private readonly app: FastifyInstance, private readonly service: MenuService) {}

  // Versi Java tanpa otorisasi di dua endpoint ini. Di sini: sidebar hanya untuk diri sendiri atau admin,
  // dan override hanya oleh admin, supaya user biasa tidak bisa mengubah akses menu orang lain.
  userSidebar = async (req: FastifyRequest<{ Params: { userId: number } }>) => {
    const me = await authorize(this.app, req.userEmail, ['ADMIN', 'USER', 'SUPER_ADMIN']);
    if (me.id !== req.params.userId && !ADMIN_OR_SUPER.includes(me.roleName as never)) throw new ForbiddenError('Not authorized to access this resource');
    return ok('Successfully retrieved user sidebar menus', await this.service.getUserSidebar(req.params.userId));
  };

  setOverride = async (req: FastifyRequest<{ Body: { userId: number; menuId: number; isAllowed: boolean } }>) => {
    await authorize(this.app, req.userEmail, ADMIN_OR_SUPER);
    await this.service.setUserOverride(req.body);
    return ok('Successfully updated user-specific menu access');
  };
}
