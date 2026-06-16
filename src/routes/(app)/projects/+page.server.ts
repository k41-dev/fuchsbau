import type { PageServerLoad, Actions } from './$types';
import { isRedirect, redirect } from '@sveltejs/kit';
import { promoteUserToSupervisor, requireSupervisor } from '$lib/server/account-role';
import { DrizzleProjectRepository } from '../../../infrastructure/repositories/DrizzleProjectRepository';
import { CreateProjectUseCase } from '../../../application/projects/CreateProjectUseCase';
import {
	attachProjectBackgroundImage,
	getBackgroundFileFromForm
} from '$lib/server/project-images';
import { getProjectStaleSummaries, getSupervisorStaleAlerts } from '$lib/server/stale-alerts';

const projectRepo = new DrizzleProjectRepository();
const createProjectUseCase = new CreateProjectUseCase(projectRepo);

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireSupervisor(locals);
	const projectRecords = (await projectRepo.findByUserId(user.id)).map((p) => p.toRecord());
	const ownedIds = projectRecords.filter((p) => p.userId === user.id).map((p) => p.id);
	const staleSummaries = await getProjectStaleSummaries(ownedIds);
	const staleByProject = new Map(staleSummaries.map((s) => [s.projectId, s.staleCount]));
	const staleAlerts = await getSupervisorStaleAlerts(user.id);

	return {
		projects: projectRecords.map((p) => ({
			...p,
			staleAlertCount: staleByProject.get(p.id) ?? 0
		})),
		currentUserId: user.id,
		staleAlerts
	};
};

export const actions: Actions = {
	createProject: async ({ request, locals }) => {
		const user = requireSupervisor(locals);
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

			const background = getBackgroundFileFromForm(formData);
			if (background && created.id) {
				await attachProjectBackgroundImage(created.id, background);
			}

			throw redirect(303, `/projects/${created.id}`);
		} catch (e: unknown) {
			if (isRedirect(e)) throw e;

			const message = e instanceof Error ? e.message : 'Failed to create project';
			return { success: false, error: message };
		}
	},

	promoteSupervisor: async ({ request, locals }) => {
		const user = requireSupervisor(locals);
		const formData = await request.formData();
		const email = (formData.get('email') as string) || '';

		try {
			await promoteUserToSupervisor({
				requesterId: user.id,
				email
			});
			return { success: true, promoted: true };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to grant supervisor access';
			return { success: false, error: message };
		}
	}
};