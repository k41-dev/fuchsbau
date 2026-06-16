import { redirect } from '@sveltejs/kit';
import type { AppUser } from '$lib/auth-user';

export function requireUser(locals: App.Locals): AppUser {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	return locals.user;
}