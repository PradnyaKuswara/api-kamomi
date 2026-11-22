import type { FastifyInstance } from 'fastify';
import { FaqController } from './faq.controller.js';
import { FaqRepository } from './faq.repository.js';
import { FaqService } from './faq.service.js';

export async function faqRoutes(app: FastifyInstance) {
  const c = new FaqController(new FaqService(new FaqRepository(app.db)));
  app.get('/api/faqs', c.list);
  app.get('/api/faqs/category/:category', c.listByCategory);
}
