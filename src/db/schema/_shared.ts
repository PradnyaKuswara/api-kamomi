import { bigint, jsonb, pgSchema, timestamp } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/** Semua tabel berada di schema Postgres "kamomi" (bukan public), sama seperti entity JPA. */
export const kamomi = pgSchema('kamomi');

/** Hibernate memetakan ZonedDateTime ke timestamp(6) with time zone. */
export const tstz = (name: string) => timestamp(name, { withTimezone: true, precision: 6, mode: 'date' });

export const pk = () => bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity();
export const fk = (name: string) => bigint(name, { mode: 'number' });

export const auditData = () => ({
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
});

export type UserRef = () => AnyPgColumn;
