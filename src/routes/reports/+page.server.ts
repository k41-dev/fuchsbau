import type { Actions, PageServerLoad } from './$types';
import { CorrectTimeEntryUseCase } from '../../application/clocking/CorrectTimeEntryUseCase';
import { DrizzleTimeEntryRepository } from '../../infrastructure/repositories/DrizzleTimeEntryRepository';
import { parseLocalDateTimeInput } from '$lib/datetime-input';
import { requireSupervisor } from '$lib/server/account-role';
import {
	getDefaultDateRange,
	getReportProjects,
	getTimeReport,
	getAbsenceReport
} from '$lib/server/reports';
import { getCorrectionCountsByEntry } from '$lib/server/time-corrections';

const timeEntryRepo = new DrizzleTimeEntryRepository();
const correctTimeEntryUseCase = new CorrectTimeEntryUseCase(timeEntryRepo);

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireSupervisor(locals);
	const defaults = getDefaultDateRange();

	const from = url.searchParams.get('from') ?? defaults.from;
	const to = url.searchParams.get('to') ?? defaults.to;
	const projectParam = url.searchParams.get('project');
	const projectId = projectParam ? parseInt(projectParam) : null;

	const projects = await getReportProjects(user.id);
	const resolvedProjectId = projectId && !isNaN(projectId) ? projectId : null;

	const report = await getTimeReport({
		userId: user.id,
		from,
		to,
		projectId: resolvedProjectId
	});

	const absenceReport = await getAbsenceReport({
		userId: user.id,
		from,
		to,
		projectId: resolvedProjectId
	});

	const totalHours = Math.round(report.entries.reduce((sum, e) => sum + e.hours, 0) * 100) / 100;
	const totalSickDays = absenceReport.absences.filter((a) => a.type === 'sick').length;
	const totalVacationDays = absenceReport.absences.filter((a) => a.type === 'vacation').length;
	const ownedProjectIds = new Set(projects.filter((p) => p.isOwner).map((p) => p.id));
	const correctionCounts = await getCorrectionCountsByEntry(
		report.entries.map((e) => e.entryId)
	);

	return {
		from,
		to,
		projectId: resolvedProjectId,
		projects,
		summaries: report.summaries,
		entries: report.entries.map((e) => ({
			...e,
			startTime: e.startTime.toISOString(),
			endTime: e.endTime?.toISOString() ?? null,
			canCorrect: e.projectId !== null && ownedProjectIds.has(e.projectId),
			correctionCount: correctionCounts.get(e.entryId) ?? 0
		})),
		absences: absenceReport.absences,
		absenceSummaries: absenceReport.summaries,
		totalHours,
		totalEntries: report.entries.length,
		totalSickDays,
		totalVacationDays,
		totalAbsences: absenceReport.absences.length,
		isOwnerView: report.isOwnerView || absenceReport.isOwnerView
	};
};

export const actions: Actions = {
	correctEntry: async ({ request, locals }) => {
		const user = requireSupervisor(locals);
		const formData = await request.formData();

		const entryId = Number.parseInt(formData.get('entryId') as string, 10);
		const startTimeRaw = formData.get('startTime') as string;
		const endTimeRaw = (formData.get('endTime') as string) || '';
		const reason = (formData.get('reason') as string) || '';

		if (!entryId || Number.isNaN(entryId)) {
			return { success: false, error: 'Invalid time entry' };
		}

		try {
			const existing = await timeEntryRepo.findById(entryId);
			if (!existing) {
				return { success: false, error: 'Time entry not found' };
			}

			const keepRunning = existing.isRunning && formData.get('keepRunning') === 'on';
			const startTime = parseLocalDateTimeInput(startTimeRaw, 'Start time');
			const endTime = keepRunning
				? null
				: parseLocalDateTimeInput(endTimeRaw, 'End time');

			await correctTimeEntryUseCase.execute({
				entryId,
				correctedByUserId: user.id,
				startTime,
				endTime,
				reason
			});

			return { success: true, corrected: true };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to correct entry';
			return { success: false, error: message };
		}
	}
};