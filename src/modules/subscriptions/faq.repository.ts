import { and, asc, eq } from 'drizzle-orm';
import { faqs } from '../../db/schema/index.js';
import { BaseRepository } from '../../lib/base-repository.js';

export class FaqRepository extends BaseRepository {
  findActive() {
    return this.db.select().from(faqs).where(eq(faqs.isActive, true)).orderBy(asc(faqs.category), asc(faqs.sequence));
  }

  findActiveByCategory(category: string) {
    return this.db.select().from(faqs).where(and(eq(faqs.category, category), eq(faqs.isActive, true))).orderBy(asc(faqs.sequence));
  }
}
