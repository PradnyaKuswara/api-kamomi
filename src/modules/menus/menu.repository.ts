import { and, asc, eq, inArray } from 'drizzle-orm';
import { menuSections, menus, roleMenus, userMenuOverrides, users } from '../../db/schema/index.js';
import { BaseRepository } from '../../lib/base-repository.js';

export class MenuRepository extends BaseRepository {
  async findUser(id: number) {
    const [u] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return u;
  }

  async userExists(id: number) {
    const [u] = await this.db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    return !!u;
  }

  async menuExists(id: number) {
    const [m] = await this.db.select({ id: menus.id }).from(menus).where(eq(menus.id, id)).limit(1);
    return !!m;
  }

  async roleMenuIds(roleId: number) {
    return (await this.db.select().from(roleMenus).where(eq(roleMenus.roleId, roleId))).map((rm) => rm.menuId);
  }

  findOverrides(userId: number) {
    return this.db.select().from(userMenuOverrides).where(eq(userMenuOverrides.userId, userId));
  }

  findActiveMenusWithSection(ids: number[]) {
    return this.db.select({ menu: menus, section: menuSections }).from(menus)
      .leftJoin(menuSections, eq(menus.sectionId, menuSections.id))
      .where(and(eq(menus.isActive, true), inArray(menus.id, ids)))
      .orderBy(asc(menus.orderNo));
  }

  async findOverride(userId: number, menuId: number) {
    const [o] = await this.db.select().from(userMenuOverrides)
      .where(and(eq(userMenuOverrides.userId, userId), eq(userMenuOverrides.menuId, menuId))).limit(1);
    return o;
  }

  async updateOverride(id: number, isAllowed: boolean) {
    await this.db.update(userMenuOverrides).set({ isAllowed }).where(eq(userMenuOverrides.id, id));
  }

  async insertOverride(v: { userId: number; menuId: number; isAllowed: boolean }) {
    await this.db.insert(userMenuOverrides).values(v);
  }
}
