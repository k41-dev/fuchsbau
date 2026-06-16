import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import type { Handle } from '@sveltejs/kit';
import { getLoginRedirect, isPublicRoute } from '$lib/server/route-guard';

export const handle: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;

	if (!event.locals.user && !isPublicRoute(event.url.pathname)) {
		throw redirect(303, getLoginRedirect(event.url.pathname, event.url.search));
	}

	return svelteKitHandler({ event, resolve, auth, building });
};