import type { RequestHandler } from '@sveltejs/kit';
import { requireUser } from '$lib/server/require-auth';
import {
	getDefaultDateRange,
	getTimeReport,
	getAbsenceReport,
	entriesToCsv
} from '$lib/server/reports';

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireUser(locals);
	const defaults = getDefaultDateRange();

	const from = url.searchParams.get('from') ?? defaults.from;
	const to = url.searchParams.get('to') ?? defaults.to;
	const projectParam = url.searchParams.get('project');
	const projectId = projectParam ? parseInt(projectParam) : null;

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

	const csv = entriesToCsv(report.entries, absenceReport.absences);
	const filename = `fuchsbau-report-${from}-to-${to}.csv`;

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};