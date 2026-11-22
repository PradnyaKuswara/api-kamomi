import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { ZodType } from 'zod';
import type { DbOrTx } from '../../db/client.js';
import type { RoleName } from '../users/authz.js';

/** Kolom minimum yang dimiliki tabel milik-properti dengan soft delete. */
export interface ScopedTable extends PgTable {
  id: PgColumn; propertyId: PgColumn; createdAt: PgColumn; deletedAt: PgColumn;
}

export interface ScopedCrudConfig<TTable extends ScopedTable, TBody> {
  path: string;                         // mis. 'rules' -> /api/properties/:propertyId/rules
  label: string;                        // untuk pesan: "master rule", "facility guide", "contact"
  notFound: (id: number) => string;
  table: TTable;
  body: ZodType<TBody>;
  /** Pesan sukses (Java berbeda-beda per modul). */
  messages: { list: string; create: string; update: string; delete: string };
  deleteRoles?: RoleName[];
  toDto: (row: TTable['$inferSelect']) => unknown;
  /** Nilai kolom untuk insert dari body (tanpa kolom audit). */
  toInsert: (b: TBody) => Record<string, unknown>;
  /** Nilai kolom untuk update dari body + baris lama. */
  toUpdate: (b: TBody, old: TTable['$inferSelect']) => Record<string, unknown>;
  /** Snapshot untuk log. */
  snapshot: (row: TTable['$inferSelect']) => unknown;
  writeLog: (db: DbOrTx, itemId: number, actorId: number, action: string, oldData: unknown, newData: unknown) => Promise<unknown>;
  hasUpdatedBy?: boolean;
}
