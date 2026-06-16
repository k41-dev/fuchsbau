import { dev } from '$app/environment';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { db } from '../../infrastructure/db/client';
import * as schema from '../../infrastructure/db/schema';
import { INVITE_COOKIE_NAME } from '../invites';
import { resolveInitialAccountRole } from './account-role';
import {
	acceptPendingInvitesForUser,
	assertWorkerRegistrationAllowed
} from './worker-invites';

function normalizeAuthUrl(url: string | undefined): string {
	const trimmed = url?.trim().replace(/^['"]+|['"]+$/g, '');
	if (!trimmed) {
		if (dev) return 'http://localhost:5173';
		throw new Error('BETTER_AUTH_URL is required');
	}
	return trimmed;
}

const baseURL = normalizeAuthUrl(env.BETTER_AUTH_URL);

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema
	}),
	emailAndPassword: {
		enabled: true
	},
	user: {
		additionalFields: {
			accountRole: {
				type: 'string',
				required: true,
				defaultValue: 'worker',
				input: false,
				returned: true
			}
		}
	},
	databaseHooks: {
		user: {
			create: {
				before: async (userData) => {
					const inviteToken = getRequestEvent()?.cookies.get(INVITE_COOKIE_NAME) ?? undefined;

					await assertWorkerRegistrationAllowed(
						userData.email,
						inviteToken,
						resolveInitialAccountRole
					);

					const accountRole = await resolveInitialAccountRole(userData.email);
					return { data: { accountRole } };
				},
				after: async (user) => {
					if (user.accountRole === 'worker') {
						await acceptPendingInvitesForUser(user.id, user.email);
					}

					const event = getRequestEvent();
					event?.cookies.delete(INVITE_COOKIE_NAME, { path: '/' });
				}
			}
		}
	},
	secret: env.BETTER_AUTH_SECRET,
	baseURL,
	trustedOrigins: dev
		? async (request) => {
				const origins = new Set<string>(['http://localhost:5173']);

				try {
					origins.add(new URL(baseURL).origin);
				} catch {
					// ignore invalid base URL
				}

				const origin = request?.headers.get('origin');
				if (origin && origin !== 'null') {
					try {
						origins.add(new URL(origin).origin);
					} catch {
						// ignore invalid origin header
					}
				}

				return [...origins];
			}
		: undefined,
	plugins: [sveltekitCookies(getRequestEvent)]
});