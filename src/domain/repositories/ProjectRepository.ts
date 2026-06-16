import type { Project } from '../entities/Project';

export interface ProjectRepository {
	findById(id: number): Promise<Project | null>;
	findByUserId(userId: string): Promise<Project[]>;
	save(project: Project): Promise<Project>;
}