import type { Db, DbOrTx } from '../db/client.js';

/**
 * Dasar semua repository. `transaction` menjalankan `fn` dengan instance repository
 * (kelas yang sama) yang terikat ke handle transaksi, sehingga service tidak perlu menyentuh Drizzle.
 */
export abstract class BaseRepository {
  constructor(protected readonly db: DbOrTx) {}

  transaction<T>(fn: (repo: this) => Promise<T>): Promise<T> {
    const Ctor = this.constructor as new (db: DbOrTx) => this;
    return (this.db as Db).transaction((tx) => fn(new Ctor(tx)));
  }
}
