import type { FastifyRequest } from 'fastify';
import { ok } from '../../lib/api-response.js';
import type { FaqService } from './faq.service.js';

export class FaqController {
  constructor(private readonly service: FaqService) {}

  list = async () => ok('Successfully retrieved FAQs', await this.service.list());

  listByCategory = async (req: FastifyRequest<{ Params: { category: string } }>) =>
    ok(`Successfully retrieved FAQs for category: ${req.params.category}`, await this.service.listByCategory(req.params.category));
}
