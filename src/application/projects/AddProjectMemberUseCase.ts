import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { project, projectMember, user } from '../../infrastructure/db/schema';

export class AddProjectMemberUseCase {
	async execute(params: { projectId: number; email: string; requesterId: string }): Promise<void> {
		const [proj] = await db
			.select()
			.from(project)
			.where(eq(project.id, params.projectId))
			.limit(1);

		if (!proj) {
			throw new Error('Project not found');
		}

		if (proj.userId !== params.requesterId) {
			throw new Error('Only the project owner can add crew members');
		}

		const normalizedEmail = params.email.trim().toLowerCase();

		const [memberUser] = await db
			.select()
			.from(user)
			.where(sql`lower(${user.email}) = ${normalizedEmail}`)
			.limit(1);

		if (!memberUser) {
			throw new Error('No user found with that email. They need to register first.');
		}

		const existing = await db
			.select()
			.from(projectMember)
			.where(
				and(eq(projectMember.projectId, params.projectId), eq(projectMember.userId, memberUser.id))
			)
			.limit(1);

		if (existing.length > 0) {
			throw new Error('This user is already on the crew');
		}

		await db.insert(projectMember).values({
			projectId: params.projectId,
			userId: memberUser.id
		});
	}
}