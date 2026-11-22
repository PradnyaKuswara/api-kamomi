import type { faqs } from '../../db/schema/index.js';
import type { FaqRepository } from './faq.repository.js';

const dto = (f: typeof faqs.$inferSelect) => ({
  id: f.id, category: f.category, question: f.question, answer: f.answer,
  sequence: f.sequence, isActive: f.isActive, createdAt: f.createdAt,
});

export class FaqService {
  constructor(private readonly repo: FaqRepository) {}
  async list() { return (await this.repo.findActive()).map(dto); }
  async listByCategory(category: string) { return (await this.repo.findActiveByCategory(category)).map(dto); }
}
