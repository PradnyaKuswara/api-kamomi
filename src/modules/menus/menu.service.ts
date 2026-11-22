import type { menuSections } from '../../db/schema/index.js';
import { NotFoundError } from '../../errors/app-error.js';
import type { MenuRepository } from './menu.repository.js';

interface MenuDto {
  id: number; title: string; url: string | null; icon: string | null;
  orderNo: number; parentId: number | null; children: MenuDto[];
}

const byOrder = <T extends { orderNo: number | null }>(a: T, b: T) => (a.orderNo ?? -Infinity) - (b.orderNo ?? -Infinity);

export class MenuService {
  constructor(private readonly repo: MenuRepository) {}

  async getUserSidebar(userId: number) {
    const user = await this.repo.findUser(userId);
    if (!user) throw new NotFoundError(`User not found with id: ${userId}`);

    // Menu dari role, lalu override per-user (allow menambah, deny mencabut).
    const allowed = new Set<number>();
    for (const menuId of await this.repo.roleMenuIds(user.roleId)) allowed.add(menuId);
    for (const o of await this.repo.findOverrides(userId)) {
      if (o.isAllowed) allowed.add(o.menuId); else allowed.delete(o.menuId);
    }
    if (allowed.size === 0) return [];

    const rows = await this.repo.findActiveMenusWithSection([...allowed]);

    const dtos = new Map<number, MenuDto>();
    for (const { menu } of rows) {
      dtos.set(menu.id, { id: menu.id, title: menu.title, url: menu.url, icon: menu.icon, orderNo: menu.orderNo, parentId: menu.parentId, children: [] });
    }
    const roots: { dto: MenuDto; section: typeof menuSections.$inferSelect | null }[] = [];
    for (const { menu, section } of rows) {
      const dto = dtos.get(menu.id)!;
      const parent = menu.parentId == null ? undefined : dtos.get(menu.parentId);
      if (parent) parent.children.push(dto); else roots.push({ dto, section });
    }
    roots.sort((a, b) => byOrder(a.dto, b.dto));

    // Kelompokkan per section; menu tanpa section masuk "Lainnya" (id 999).
    const sections = new Map<number, { id: number; title: string; orderNo: number; menus: MenuDto[] }>();
    for (const { dto, section } of roots) {
      const id = section?.id ?? 999;
      let s = sections.get(id);
      if (!s) sections.set(id, (s = { id, title: section?.title ?? 'Lainnya', orderNo: section?.orderNo ?? 999, menus: [] }));
      s.menus.push(dto);
    }
    return [...sections.values()].sort(byOrder);
  }

  async setUserOverride(b: { userId: number; menuId: number; isAllowed: boolean }) {
    if (!(await this.repo.userExists(b.userId))) throw new NotFoundError(`User not found with id: ${b.userId}`);
    if (!(await this.repo.menuExists(b.menuId))) throw new NotFoundError(`Menu not found with id: ${b.menuId}`);
    const existing = await this.repo.findOverride(b.userId, b.menuId);
    if (existing) await this.repo.updateOverride(existing.id, b.isAllowed);
    else await this.repo.insertOverride(b);
  }
}
