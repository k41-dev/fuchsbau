import { eq, desc, or, and, isNotNull } from 'drizzle-orm';
import { db } from '../db/client';
import { project, projectMember } from '../db/schema';
import type { ProjectRepository } from '../../domain/repositories/ProjectRepository';
import { Project } from '../../domain/entities/Project';

const projectListColumns = {
	id: project.id,
	name: project.name,
	description: project.description,
	address: project.address,
	color: project.color,
	backgroundImageContentType: project.backgroundImageContentType,
	userId: project.userId,
	createdAt: project.createdAt,
	updatedAt: project.updatedAt
};

export class DrizzleProjectRepository implements ProjectRepository {
	async findById(id: number): Promise<Project | null> {
		const [result] = await db
			.select(projectListColumns)
			.from(project)
			.where(eq(project.id, id))
			.limit(1);
		return result ? this.mapToEntity(result) : null;
	}

	async findByUserId(userId: string): Promise<Project[]> {
		const results = await db
			.select({ project: projectListColumns })
			.from(project)
			.leftJoin(
				projectMember,
				and(eq(projectMember.projectId, project.id), eq(projectMember.userId, userId))
			)
			.where(or(eq(project.userId, userId), isNotNull(projectMember.id)))
			.orderBy(desc(project.createdAt));

		return results.map((row) => this.mapToEntity(row.project));
	}

	async save(projectEntity: Project): Promise<Project> {
		const [result] = await db
			.insert(project)
			.values({
				name: projectEntity.name,
				description: projectEntity.description,
				address: projectEntity.address,
				color: projectEntity.color,
				userId: projectEntity.userId
			})
			.returning(projectListColumns);

		return this.mapToEntity(result);
	}

	private mapToEntity(row: {
		id: number;
		name: string;
		description: string | null;
		address: string | null;
		color: string | null;
		backgroundImageContentType: string | null;
		userId: string;
		createdAt: Date;
		updatedAt: Date;
	}): Project {
		return new Project(
			row.id,
			row.name,
			row.description,
			row.address,
			row.color,
			Boolean(row.backgroundImageContentType),
			row.userId,
			row.createdAt,
			row.updatedAt
		);
	}
}