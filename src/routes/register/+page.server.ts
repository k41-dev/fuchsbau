import { redirect } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { INVITE_COOKIE_NAME } from '$lib/invites';
import { db } from '../../infrastructure/db/client';
import { user } from '../../infrastructure/db/schema';
import { getInviteRegistrationDetails } from '$lib/server/worker-invites';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	if (locals.user) {
		throw redirect(303, '/');
	}

	const inviteToken = url.searchParams.get('invite');
	let invite: {
		email: string;
		projectName: string;
		expiresAt: string;
	} | null = null;

	if (inviteToken) {
		const details = await getInviteRegistrationDetails(inviteToken);
		if (details) {
			cookies.set(INVITE_COOKIE_NAME, inviteToken, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 60 * 60
			});

			invite = {
				email: details.email,
				projectName: details.projectName,
				expiresAt: details.expiresAt.toISOString()
			};
		}
	}

	const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(user);

	return {
		invite,
		isBootstrap: count === 0,
		canRegister: Boolean(invite) || count === 0
	};
};