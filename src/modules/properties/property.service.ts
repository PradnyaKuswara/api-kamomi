import type { properties } from '../../db/schema/index.js';
import { NotFoundError } from '../../errors/app-error.js';
import type { PropertyRepository } from './property.repository.js';

export type PropertyRow = typeof properties.$inferSelect;

export const toPropertyDto = (p: PropertyRow) => ({
  id: p.id,
  propertyType: p.propertyType,
  name: p.name,
  description: p.description,
  address: p.address,
  city: p.city,
  province: p.province,
  postalCode: p.postalCode,
  isActive: p.isActive,
  createdAt: p.createdAt,
});

export interface PropertyInput {
  propertyType?: string | null; name: string; description?: string | null; address?: string | null;
  city?: string | null; province?: string | null; postalCode?: string | null;
}

export class PropertyService {
  constructor(private readonly repo: PropertyRepository) {}

  async listForUser(userId: number) { return (await this.repo.findByUserId(userId)).map(toPropertyDto); }

  async create(email: string, b: PropertyInput) {
    const userId = await this.repo.findUserIdByEmail(email);
    if (userId === undefined) throw new NotFoundError('User not found');
    const now = new Date();
    const property = await this.repo.createWithOwner({
      userId, propertyType: b.propertyType ?? 'HOUSE', name: b.name, description: b.description ?? null,
      address: b.address ?? '-', city: b.city ?? '-', province: b.province ?? '-', postalCode: b.postalCode ?? null,
      isActive: true, createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId,
    }, userId);
    return toPropertyDto(property);
  }
}
