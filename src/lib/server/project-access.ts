import { error } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { project, projectMember } from '../../infrastructure/db/schema';
import type { User } from 'better-auth';

export async function getProjectAccess(projectId: number, user: User) {
	const [proj] = await db.select().from(project).where(eq(project.id, projectId)).limit(1);

	if (!proj) {
		throw error(404, 'Project not found');
	}

	const isOwner = proj.userId === user.id;

	const membership = await db
		.select()
		.from(projectMember)
		.where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, user.id)))
		.limit(1);

	const isMember = membership.length > 0 || isOwner;

	if (!isMember) {
		throw error(403, 'You are not assigned to this project');
	}

	return {
		project: proj,
		isOwner,
		isMember,
		canManage: isOwner,
		canClockIn: isMember
	};
}