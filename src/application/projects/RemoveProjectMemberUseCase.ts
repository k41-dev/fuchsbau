import { eq, and } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { project, projectMember } from '../../infrastructure/db/schema';

export class RemoveProjectMemberUseCase {
	async execute(params: {
		projectId: number;
		memberUserId: string;
		requesterId: string;
	}): Promise<void> {
		const [proj] = await db
			.select()
			.from(project)
			.where(eq(project.id, params.projectId))
			.limit(1);

		if (!proj) {
			throw new Error('Project not found');
		}

		if (proj.userId !== params.requesterId) {
			throw new Error('Only the project owner can remove crew members');
		}

		if (params.memberUserId === proj.userId) {
			throw new Error('The project owner cannot be removed from the crew');
		}

		await db
			.delete(projectMember)
			.where(
				and(
					eq(projectMember.projectId, params.projectId),
					eq(projectMember.userId, params.memberUserId)
				)
			);
	}
}