import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { project, projectMember, user } from '../../infrastructure/db/schema';
import { normalizeInviteEmail } from '../../lib/invites';
import {
	buildInviteUrl,
	createWorkerInvite,
	findPendingInvite
} from '../../lib/server/worker-invites';

export type InviteProjectMemberResult =
	| { type: 'added'; email: string }
	| { type: 'invited'; email: string; token: string; inviteUrl: string; expiresAt: Date }
	| { type: 'existing_invite'; email: string; token: string; inviteUrl: string; expiresAt: Date };

export class InviteProjectMemberUseCase {
	async execute(params: {
		projectId: number;
		email: string;
		requesterId: string;
		origin?: string;
	}): Promise<InviteProjectMemberResult> {
		const [proj] = await db
			.select()
			.from(project)
			.where(eq(project.id, params.projectId))
			.limit(1);

		if (!proj) {
			throw new Error('Project not found');
		}

		if (proj.userId !== params.requesterId) {
			throw new Error('Only the project owner can invite crew members');
		}

		const normalizedEmail = normalizeInviteEmail(params.email);

		const [memberUser] = await db
			.select()
			.from(user)
			.where(sql`lower(${user.email}) = ${normalizedEmail}`)
			.limit(1);

		if (memberUser) {
			if (memberUser.id === proj.userId) {
				throw new Error('The project owner is already on this job site');
			}

			const existing = await db
				.select()
				.from(projectMember)
				.where(
					and(
						eq(projectMember.projectId, params.projectId),
						eq(projectMember.userId, memberUser.id)
					)
				)
				.limit(1);

			if (existing.length > 0) {
				throw new Error('This user is already on the crew');
			}

			await db.insert(projectMember).values({
				projectId: params.projectId,
				userId: memberUser.id
			});

			return { type: 'added', email: normalizedEmail };
		}

		const pendingInvite = await findPendingInvite(params.projectId, normalizedEmail);
		if (pendingInvite) {
			return {
				type: 'existing_invite',
				email: normalizedEmail,
				token: pendingInvite.token,
				inviteUrl: buildInviteUrl(pendingInvite.token, params.origin),
				expiresAt: pendingInvite.expiresAt
			};
		}

		const { token, expiresAt } = await createWorkerInvite({
			projectId: params.projectId,
			email: normalizedEmail,
			invitedByUserId: params.requesterId
		});

		return {
			type: 'invited',
			email: normalizedEmail,
			token,
			inviteUrl: buildInviteUrl(token, params.origin),
			expiresAt
		};
	}
}