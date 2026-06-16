import type { ProjectRepository } from '../../domain/repositories/ProjectRepository';
import { Project } from '../../domain/entities/Project';
import { db } from '../../infrastructure/db/client';
import { projectMember } from '../../infrastructure/db/schema';

export class CreateProjectUseCase {
	constructor(private readonly projectRepository: ProjectRepository) {}

	async execute(params: {
		name: string;
		description?: string | null;
		address?: string | null;
		ownerId: string;
	}): Promise<Project> {
		const newProject = Project.create({
			name: params.name,
			description: params.description,
			address: params.address,
			userId: params.ownerId
		});

		const saved = await this.projectRepository.save(newProject);

		if (!saved.id) {
			throw new Error('Failed to create project');
		}

		await db.insert(projectMember).values({
			projectId: saved.id,
			userId: params.ownerId
		});

		return saved;
	}
}