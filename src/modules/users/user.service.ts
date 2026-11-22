import bcrypt from 'bcrypt';
import { BadRequestError, NotFoundError } from '../../errors/app-error.js';
import { toPage, type PageRequest } from '../../lib/pagination.js';
import type { UserInsert, UserRepository, UserRow } from './user.repository.js';

export const toUserDto = ({ user, roleName }: UserRow) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  roleName,
  isEmailVerified: user.isEmailVerified,
  isActive: user.isActive,
  subscription: null,
  properties: null,
});

const badRequest = (m: string) => new BadRequestError(m, m);
const now = () => new Date();

export interface UserCreateInput {
  name: string; email: string; password: string; phoneNumber?: string | null; roleName: string; isActive?: boolean | null;
}
export interface UserUpdateInput {
  name?: string | null; email?: string | null; password?: string | null; phoneNumber?: string | null;
  roleName?: string | null; isActive?: boolean | null;
}

export class UserService {
  constructor(private readonly repo: UserRepository) {}

  async getAll() { return (await this.repo.findAll()).map(toUserDto); }

  async getPage(req: PageRequest) {
    const [rows, total] = await Promise.all([this.repo.findPage(req), this.repo.count()]);
    return toPage(rows.map(toUserDto), total, req);
  }

  async getById(id: number) {
    const row = await this.repo.findRowById(id);
    if (!row) throw new NotFoundError(`User with ID ${id} not found`);
    return toUserDto(row);
  }

  private async resolveRole(roleName: string) {
    const target = roleName.toUpperCase();
    if (target !== 'ADMIN' && target !== 'USER') throw badRequest('Role must be either ADMIN or USER');
    const role = await this.repo.findRoleByName(target);
    if (!role) throw new NotFoundError(`Role ${target} not found`);
    return role;
  }

  async create(b: UserCreateInput) {
    if (await this.repo.emailExists(b.email)) throw badRequest(`Email ${b.email} is already registered`);
    const role = await this.resolveRole(b.roleName);
    const u = await this.repo.insert({
      name: b.name, email: b.email, password: await bcrypt.hash(b.password, 10), phoneNumber: b.phoneNumber ?? null,
      roleId: role.id, oauthProvider: 'LOCAL', isActive: b.isActive ?? true, isEmailVerified: true,
      createdAt: now(), updatedAt: now(),
    });
    return toUserDto({ user: u, roleName: role.name });
  }

  async update(id: number, b: UserUpdateInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError(`User with ID ${id} not found`);
    const set: Partial<UserInsert> = { updatedAt: now() };

    if (b.email && b.email.toLowerCase() !== existing.email.toLowerCase()) {
      if (await this.repo.emailExists(b.email)) throw badRequest(`Email ${b.email} is already in use`);
      set.email = b.email;
    }
    if (b.name && b.name.trim()) set.name = b.name;
    if (b.password && b.password.trim()) set.password = await bcrypt.hash(b.password, 10);
    if (b.phoneNumber != null) set.phoneNumber = b.phoneNumber;
    if (b.roleName && b.roleName.trim()) set.roleId = (await this.resolveRole(b.roleName)).id;
    if (b.isActive != null) {
      if (!b.isActive && (await this.repo.ownsActiveProperty(id))) {
        throw badRequest('User ADMIN utama (pemilik properti) tidak dapat dinonaktifkan.');
      }
      set.isActive = b.isActive;
    }
    await this.repo.update(id, set);
    return this.getById(id);
  }

  async delete(id: number, currentEmail: string) {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundError(`User with ID ${id} not found`);
    if (user.email.toLowerCase() === currentEmail.toLowerCase()) throw badRequest('Anda tidak dapat menghapus akun Anda sendiri.');
    await this.repo.delete(id);
  }
}
