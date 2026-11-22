import { NotFoundError } from '../../errors/app-error.js';
import type { RoleRepository } from './role.repository.js';

export class RoleService {
  constructor(private readonly repo: RoleRepository) {}

  list() { return this.repo.findAll(); }

  async get(id: number) {
    const role = await this.repo.findById(id);
    if (!role) throw new NotFoundError(`Role with ID ${id} not found!`);
    return role;
  }

  create(name: string) { return this.repo.insert(name.toUpperCase()); }

  async update(id: number, name: string) {
    await this.get(id);
    return this.repo.update(id, name.toUpperCase());
  }

  async remove(id: number) {
    await this.get(id);
    await this.repo.delete(id);
  }
}
