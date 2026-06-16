import type { RequestHandler } from '@sveltejs/kit';
import { requireSupervisor } from '$lib/server/account-role';
import {
	buildPayrollCsv,
	buildPayrollExportFilename,
	type PayrollExportFormat
} from '$lib/payroll-export';
import {
	getDefaultDateRange,
	getReportProjects,
	getTimeReport,
	getAbsenceReport
} from '$lib/server/reports';
import { getCorrectionCountsByEntry } from '$lib/server/time-corrections';

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireSupervisor(locals);
	const defaults = getDefaultDateRange();

	const from = url.searchParams.get('from') ?? defaults.from;
	const to = url.searchParams.get('to') ?? defaults.to;
	const projectParam = url.searchParams.get('project');
	const projectId = projectParam ? parseInt(projectParam) : null;
	const formatParam = url.searchParams.get('format');
	const format: PayrollExportFormat = formatParam === 'summary' ? 'summary' : 'full';

	const resolvedProjectId = projectId && !isNaN(projectId) ? projectId : null;
	const projects = await getReportProjects(user.id);
	const projectName = resolvedProjectId
		? (projects.find((project) => project.id === resolvedProjectId)?.name ?? null)
		: null;

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

	const correctionCounts = await getCorrectionCountsByEntry(report.entries.map((entry) => entry.entryId));

	const csv = buildPayrollCsv({
		from,
		to,
		projectName,
		generatedAt: new Date(),
		summaries: report.summaries,
		absenceSummaries: absenceReport.summaries,
		entries: report.entries.map((entry) => ({
			...entry,
			correctionCount: correctionCounts.get(entry.entryId) ?? 0
		})),
		absences: absenceReport.absences,
		format
	});

	const filename = buildPayrollExportFilename({ from, to, projectName, format });

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};