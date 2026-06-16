import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import type { Handle } from '@sveltejs/kit';
import { enrichUserAccountRole, getAccountRole } from '$lib/server/account-role';
import { getLoginRedirect, isPublicRoute, isSupervisorRoute } from '$lib/server/route-guard';

export const handle: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	const sessionUser = (session?.user as App.Locals['user']) ?? null;
	event.locals.user = sessionUser ? await enrichUserAccountRole(sessionUser) : null;
	event.locals.session = session?.session ?? null;

	if (!event.locals.user && !isPublicRoute(event.url.pathname)) {
		throw redirect(303, getLoginRedirect(event.url.pathname, event.url.search));
	}

	if (event.locals.user && isSupervisorRoute(event.url.pathname)) {
		if (getAccountRole(event.locals.user) !== 'supervisor') {
			throw redirect(303, '/');
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};