import { auth } from '$lib/server/auth';
import { toSvelteKitHandler } from 'better-auth/svelte-kit';
import type { RequestHandler } from '@sveltejs/kit';

const handler = toSvelteKitHandler(auth);

export const GET: RequestHandler = handler;
export const POST: RequestHandler = handler;