import { eq } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { project, workerInvite } from '../../infrastructure/db/schema';

export class RevokeWorkerInviteUseCase {
	async execute(params: { inviteId: number; requesterId: string }): Promise<void> {
		const [invite] = await db
			.select({
				id: workerInvite.id,
				status: workerInvite.status,
				ownerId: project.userId
			})
			.from(workerInvite)
			.innerJoin(project, eq(workerInvite.projectId, project.id))
			.where(eq(workerInvite.id, params.inviteId))
			.limit(1);

		if (!invite) {
			throw new Error('Invite not found');
		}

		if (invite.ownerId !== params.requesterId) {
			throw new Error('Only the project owner can revoke invites');
		}

		if (invite.status !== 'pending') {
			throw new Error('Only pending invites can be revoked');
		}

		await db
			.update(workerInvite)
			.set({ status: 'revoked' })
			.where(eq(workerInvite.id, params.inviteId));
	}
}