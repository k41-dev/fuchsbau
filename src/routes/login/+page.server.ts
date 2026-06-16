import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveRedirectTarget } from '$lib/server/route-guard';

export const load: PageServerLoad = async ({ locals, url }) => {
	const redirectTo = resolveRedirectTarget(url.searchParams.get('redirectTo'));

	if (locals.user) {
		throw redirect(303, redirectTo);
	}

	return { redirectTo };
};