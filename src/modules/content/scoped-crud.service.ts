import { NotFoundError } from '../../errors/app-error.js';
import { toPage, type PageRequest } from '../../lib/pagination.js';
import type { AccessGuard } from '../properties/access.js';
import type { AuthUser } from '../users/authz.js';
import type { ScopedCrudRepository } from './scoped-crud.repository.js';
import type { ScopedCrudConfig, ScopedTable } from './scoped-crud.types.js';

/**
 * Pola yang sama dipakai Rule, FacilityGuide, dan Contact di versi Java:
 * list (paged, createdAt desc) / create / update / soft-delete, tiap perubahan dicatat di tabel *_logs.
 * Ditambah isolasi tenant: aktor harus anggota properti.
 */
export class ScopedCrudService<TBody> {
  constructor(
    private readonly repo: ScopedCrudRepository,
    private readonly access: AccessGuard,
    private readonly cfg: ScopedCrudConfig<ScopedTable, TBody>,
  ) {}

  private async load(actor: AuthUser, propertyId: number, itemId: number) {
    const row = await this.repo.findActiveById(itemId);
    if (!row || row.propertyId !== propertyId) throw new NotFoundError(this.cfg.notFound(itemId));
    await this.access.property(actor, propertyId);
    return row;
  }

  async list(actor: AuthUser, propertyId: number, req: PageRequest) {
    await this.access.property(actor, propertyId);
    const [rows, total] = await Promise.all([this.repo.findPage(propertyId, req), this.repo.countByProperty(propertyId)]);
    return toPage(rows.map((x) => this.cfg.toDto(x as never)), total, req);
  }

  async create(actor: AuthUser, propertyId: number, body: TBody) {
    await this.access.property(actor, propertyId);
    const now = new Date();
    return this.repo.transaction(async (tx) => {
      const row = await tx.insert({
        ...this.cfg.toInsert(body), propertyId, createdAt: now, updatedAt: now, createdBy: actor.id,
        ...(this.cfg.hasUpdatedBy !== false && { updatedBy: actor.id }),
      });
      await tx.writeLog(row.id as number, actor.id, 'CREATE', null, this.cfg.snapshot(row as never));
      return this.cfg.toDto(row as never);
    });
  }

  async update(actor: AuthUser, propertyId: number, itemId: number, body: TBody) {
    const old = await this.load(actor, propertyId, itemId);
    return this.repo.transaction(async (tx) => {
      const row = await tx.update(itemId, {
        ...this.cfg.toUpdate(body, old as never), updatedAt: new Date(), ...(this.cfg.hasUpdatedBy !== false && { updatedBy: actor.id }),
      });
      await tx.writeLog(itemId, actor.id, 'UPDATE', this.cfg.snapshot(old as never), this.cfg.snapshot(row as never));
      return this.cfg.toDto(row as never);
    });
  }

  async remove(actor: AuthUser, propertyId: number, itemId: number) {
    const old = await this.load(actor, propertyId, itemId);
    await this.repo.transaction(async (tx) => {
      await tx.softDelete(itemId, new Date());
      await tx.writeLog(itemId, actor.id, 'DELETE', this.cfg.snapshot(old as never), null);
    });
  }
}
