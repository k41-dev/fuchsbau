import type { Role } from '../entities/Role';

export interface RoleRepository {
  findByProjectId(projectId: number): Promise<Role[]>;
  save(role: Role): Promise<Role>;
  delete(id: number): Promise<void>;
}