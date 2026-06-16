import { eq } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { role } from '../../infrastructure/db/schema';
import type { RoleRepository } from '../../domain/repositories/RoleRepository';
import { Role } from '../../domain/entities/Role';

export class DrizzleRoleRepository implements RoleRepository {
  async findByProjectId(projectId: number): Promise<Role[]> {
    const results = await db
      .select()
      .from(role)
      .where(eq(role.projectId, projectId))
      .orderBy(role.name);

    return results.map((r) => this.mapToEntity(r));
  }

  async save(roleEntity: Role): Promise<Role> {
    const [result] = await db
      .insert(role)
      .values({
        projectId: roleEntity.projectId,
        name: roleEntity.name,
        createdAt: roleEntity.createdAt,
        updatedAt: roleEntity.updatedAt,
      })
      .returning();

    return this.mapToEntity(result);
  }

  async delete(id: number): Promise<void> {
    await db.delete(role).where(eq(role.id, id));
  }

  private mapToEntity(row: typeof role.$inferSelect): Role {
    return new Role(
      row.id,
      row.projectId,
      row.name,
      row.createdAt,
      row.updatedAt
    );
  }
}