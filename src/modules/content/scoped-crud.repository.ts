import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { Db, DbOrTx } from '../../db/client.js';
import { BaseRepository } from '../../lib/base-repository.js';
import type { PageRequest } from '../../lib/pagination.js';
import type { ScopedCrudConfig, ScopedTable } from './scoped-crud.types.js';

type Row = Record<string, unknown>;

/** Akses data generik untuk tabel milik-properti dengan soft delete + tabel log per entitas. */
export class ScopedCrudRepository extends BaseRepository {
  constructor(db: DbOrTx, private readonly t: ScopedTable, private readonly logWriter: ScopedCrudConfig<ScopedTable, unknown>['writeLog']) {
    super(db);
  }

  override transaction<T>(fn: (repo: this) => Promise<T>): Promise<T> {
    return (this.db as Db).transaction((tx) => fn(new ScopedCrudRepository(tx, this.t, this.logWriter) as this));
  }

  private where(propertyId: number) { return and(eq(this.t.propertyId, propertyId), isNull(this.t.deletedAt)); }

  findPage(propertyId: number, req: PageRequest) {
    return this.db.select().from(this.t).where(this.where(propertyId)).orderBy(desc(this.t.createdAt)).limit(req.size).offset(req.page * req.size) as Promise<Row[]>;
  }

  async countByProperty(propertyId: number) {
    const [r] = await this.db.select({ total: count() }).from(this.t).where(this.where(propertyId));
    return r?.total ?? 0;
  }

  async findActiveById(id: number) {
    const [row] = await this.db.select().from(this.t).where(and(eq(this.t.id, id), isNull(this.t.deletedAt))).limit(1) as Row[];
    return row;
  }

  async insert(values: Row) {
    const [row] = await this.db.insert(this.t).values(values as never).returning() as Row[];
    return row!;
  }

  async update(id: number, values: Row) {
    const [row] = await this.db.update(this.t).set(values as never).where(eq(this.t.id, id)).returning() as Row[];
    return row!;
  }

  async softDelete(id: number, at: Date) { await this.db.update(this.t).set({ deletedAt: at } as never).where(eq(this.t.id, id)); }

  writeLog(itemId: number, actorId: number, action: string, oldData: unknown, newData: unknown) {
    return this.logWriter(this.db, itemId, actorId, action, oldData, newData);
  }
}
