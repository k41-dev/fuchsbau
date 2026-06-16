import { error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { requireUser } from '$lib/server/require-auth';
import { getProjectAccess } from '$lib/server/project-access';
import { readProjectBackgroundImage } from '$lib/server/project-images';

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	const projectId = Number.parseInt(params.projectId ?? '', 10);

	if (!params.projectId || !projectId || Number.isNaN(projectId)) {
		throw error(400, 'Invalid project');
	}

	await getProjectAccess(projectId, user);

	const image = await readProjectBackgroundImage(projectId);

	if (!image) {
		throw error(404, 'Image not found');
	}

	return new Response(new Uint8Array(image.data), {
		headers: {
			'Content-Type': image.contentType,
			'Cache-Control': 'private, max-age=3600'
		}
	});
};