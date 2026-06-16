import type { AbsenceSummaryRow, ReportAbsence, ReportEntry, ReportSummary } from './server/reports';
import { absenceTypeLabel } from './server/reports';

export type PayrollExportFormat = 'summary' | 'full';

export type PayrollExportEntry = ReportEntry & {
	correctionCount: number;
};

export type PayrollExportInput = {
	from: string;
	to: string;
	projectName: string | null;
	generatedAt: Date;
	summaries: ReportSummary[];
	absenceSummaries: AbsenceSummaryRow[];
	entries: PayrollExportEntry[];
	absences: ReportAbsence[];
	format: PayrollExportFormat;
};

const UTF8_BOM = '\uFEFF';

function escapeCsvCell(value: string | number | null | undefined): string {
	const text = value == null ? '' : String(value);
	return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(cells: Array<string | number | null | undefined>): string {
	return cells.map(escapeCsvCell).join(',');
}

function formatHours(hours: number): string {
	return hours.toFixed(2);
}

function formatExportDateTime(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
}

export function buildPayrollExportFilename(input: {
	from: string;
	to: string;
	projectName: string | null;
	format: PayrollExportFormat;
}): string {
	const slug = input.projectName ? slugify(input.projectName) : 'all-sites';
	const suffix = input.format === 'summary' ? '_summary' : '';
	return `fuchsbau-payroll_${slug}_${input.from}_${input.to}${suffix}.csv`;
}

function entryStatus(entry: PayrollExportEntry): string {
	if (entry.isRunning) return 'Open shift';
	if (entry.correctionCount > 0) return `Corrected (${entry.correctionCount}x)`;
	return 'Complete';
}

function buildMetadataLines(input: PayrollExportInput): string[] {
	const projectLabel = input.projectName ?? 'All job sites';
	const generated = formatExportDateTime(input.generatedAt);

	return [
		`# Fuchsbau payroll export`,
		`# Period,${input.from},to,${input.to}`,
		`# Job site,${projectLabel}`,
		`# Generated,${generated}`,
		`# Format,${input.format}`,
		''
	];
}

function buildHoursSummarySection(input: PayrollExportInput): string[] {
	const lines = [
		'Hours summary',
		csvRow(['Worker', 'Email', 'Job Site', 'Entries', 'Work Hours'])
	];

	let totalHours = 0;
	let totalEntries = 0;

	for (const row of input.summaries) {
		lines.push(
			csvRow([
				row.userName ?? row.userEmail,
				row.userEmail,
				row.projectName,
				row.entryCount,
				formatHours(row.totalHours)
			])
		);
		totalHours += row.totalHours;
		totalEntries += row.entryCount;
	}

	if (input.summaries.length > 0) {
		lines.push(csvRow(['Total', '', '', totalEntries, formatHours(totalHours)]));
	}

	return lines;
}

function buildAbsenceSummarySection(input: PayrollExportInput): string[] {
	const lines = [
		'',
		'Absence summary (approved days)',
		csvRow(['Worker', 'Email', 'Sick Days', 'Vacation Days'])
	];

	let totalSick = 0;
	let totalVacation = 0;

	for (const row of input.absenceSummaries) {
		lines.push(
			csvRow([
				row.userName ?? row.userEmail,
				row.userEmail,
				row.sickDays,
				row.vacationDays
			])
		);
		totalSick += row.sickDays;
		totalVacation += row.vacationDays;
	}

	if (input.absenceSummaries.length > 0) {
		lines.push(csvRow(['Total', '', totalSick, totalVacation]));
	}

	return lines;
}

function buildTimeEntryDetailSection(input: PayrollExportInput): string[] {
	const lines = [
		'',
		'Time entry detail',
		csvRow([
			'Entry ID',
			'Worker',
			'Email',
			'Job Site',
			'Role',
			'Date',
			'Start',
			'End',
			'Hours',
			'Status',
			'Note'
		])
	];

	for (const entry of input.entries) {
		lines.push(
			csvRow([
				entry.entryId,
				entry.userName ?? '',
				entry.userEmail,
				entry.projectName,
				entry.roleName ?? '',
				entry.date,
				formatExportDateTime(entry.startTime),
				entry.endTime ? formatExportDateTime(entry.endTime) : '',
				formatHours(entry.hours),
				entryStatus(entry),
				entry.description ?? ''
			])
		);
	}

	return lines;
}

function buildAbsenceDetailSection(input: PayrollExportInput): string[] {
	const lines = [
		'',
		'Absence detail',
		csvRow(['Worker', 'Email', 'Date', 'Type', 'Status', 'Note'])
	];

	for (const absence of input.absences) {
		lines.push(
			csvRow([
				absence.userName ?? '',
				absence.userEmail,
				absence.date,
				absenceTypeLabel(absence.type),
				absence.status,
				absence.note ?? ''
			])
		);
	}

	return lines;
}

export function buildPayrollCsv(input: PayrollExportInput): string {
	const lines = [
		...buildMetadataLines(input),
		...buildHoursSummarySection(input),
		...buildAbsenceSummarySection(input)
	];

	if (input.format === 'full') {
		lines.push(...buildTimeEntryDetailSection(input), ...buildAbsenceDetailSection(input));
	}

	return UTF8_BOM + lines.join('\n');
}

