import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/require-auth';
import {
	getDefaultDateRange,
	getReportProjects,
	getTimeReport,
	getAbsenceReport
} from '$lib/server/reports';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals);
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

	return {
		from,
		to,
		projectId: resolvedProjectId,
		projects,
		summaries: report.summaries,
		entries: report.entries.map((e) => ({
			...e,
			startTime: e.startTime.toISOString(),
			endTime: e.endTime?.toISOString() ?? null
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