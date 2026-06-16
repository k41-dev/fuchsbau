import { error } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { project, projectMember } from '../../infrastructure/db/schema';
import type { AppUser } from '$lib/auth-user';

export async function getProjectAccess(projectId: number, user: AppUser) {
	const [row] = await db
		.select({
			id: project.id,
			name: project.name,
			description: project.description,
			address: project.address,
			color: project.color,
			backgroundImageContentType: project.backgroundImageContentType,
			userId: project.userId,
			createdAt: project.createdAt,
			updatedAt: project.updatedAt
		})
		.from(project)
		.where(eq(project.id, projectId))
		.limit(1);

	if (!row) {
		throw error(404, 'Project not found');
	}

	const proj = {
		...row,
		hasBackgroundImage: Boolean(row.backgroundImageContentType)
	};

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