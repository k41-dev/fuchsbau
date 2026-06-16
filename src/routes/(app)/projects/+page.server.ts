import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/require-auth';
import { DrizzleProjectRepository } from '../../../infrastructure/repositories/DrizzleProjectRepository';
import { CreateProjectUseCase } from '../../../application/projects/CreateProjectUseCase';

const projectRepo = new DrizzleProjectRepository();
const createProjectUseCase = new CreateProjectUseCase(projectRepo);

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const projects = (await projectRepo.findByUserId(user.id)).map((p) => p.toRecord());

	return {
		projects,
		currentUserId: user.id
	};
};

export const actions: Actions = {
	createProject: async ({ request, locals }) => {
		const user = requireUser(locals);
		const formData = await request.formData();

		const name = (formData.get('name') as string)?.trim();
		const description = (formData.get('description') as string)?.trim() || null;
		const address = (formData.get('address') as string)?.trim() || null;

		if (!name) {
			return { success: false, error: 'Project name is required' };
		}

		try {
			const created = await createProjectUseCase.execute({
				name,
				description,
				address,
				ownerId: user.id
			});

			throw redirect(303, `/projects/${created.id}`);
		} catch (e: unknown) {
			if (e && typeof e === 'object' && 'status' in e && 'location' in e) {
				throw e;
			}

			const message = e instanceof Error ? e.message : 'Failed to create project';
			return { success: false, error: message };
		}
	}
};