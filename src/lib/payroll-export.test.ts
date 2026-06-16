import { describe, expect, it } from 'vitest';
import {
	buildPayrollCsv,
	buildPayrollExportFilename,
	type PayrollExportEntry
} from './payroll-export';
import type { AbsenceSummaryRow, ReportAbsence, ReportSummary } from './server/reports';

const summaries: ReportSummary[] = [
	{
		userId: 'u1',
		userName: 'Alex',
		userEmail: 'alex@test',
		projectId: 1,
		projectName: 'Riverside',
		totalHours: 7.5,
		entryCount: 1
	}
];

const absenceSummaries: AbsenceSummaryRow[] = [
	{
		userId: 'u2',
		userName: 'Bea',
		userEmail: 'bea@test',
		sickDays: 1,
		vacationDays: 0
	}
];

const entries: PayrollExportEntry[] = [
	{
		entryId: 10,
		userId: 'u1',
		userName: 'Alex',
		userEmail: 'alex@test',
		projectId: 1,
		projectName: 'Riverside',
		roleName: 'Electrician',
		date: '2026-06-16',
		startTime: new Date('2026-06-16T07:00:00'),
		endTime: new Date('2026-06-16T15:30:00'),
		hours: 7.5,
		description: null,
		isRunning: false,
		correctionCount: 2
	}
];

const absences: ReportAbsence[] = [
	{
		userId: 'u2',
		userName: 'Bea',
		userEmail: 'bea@test',
		date: '2026-06-16',
		type: 'sick',
		status: 'approved',
		requestGroupId: 'g1',
		note: 'Flu'
	}
];

describe('buildPayrollCsv', () => {
	it('builds a summary export with metadata and totals', () => {
		const csv = buildPayrollCsv({
			from: '2026-06-10',
			to: '2026-06-16',
			projectName: 'Riverside',
			generatedAt: new Date('2026-06-16T12:00:00'),
			summaries,
			absenceSummaries,
			entries,
			absences,
			format: 'summary'
		});

		expect(csv.startsWith('\uFEFF')).toBe(true);
		expect(csv).toContain('# Fuchsbau payroll export');
		expect(csv).toContain('Hours summary');
		expect(csv).toContain('"Alex","alex@test","Riverside","1","7.50"');
		expect(csv).toContain('"Total","","","1","7.50"');
		expect(csv).toContain('Absence summary (approved days)');
		expect(csv).toContain('"Bea","bea@test","1","0"');
		expect(csv).not.toContain('Time entry detail');
	});

	it('includes detail sections in full export', () => {
		const csv = buildPayrollCsv({
			from: '2026-06-10',
			to: '2026-06-16',
			projectName: null,
			generatedAt: new Date('2026-06-16T12:00:00'),
			summaries,
			absenceSummaries,
			entries,
			absences,
			format: 'full'
		});

		expect(csv).toContain('Time entry detail');
		expect(csv).toContain('"Corrected (2x)"');
		expect(csv).toContain('Absence detail');
		expect(csv).toContain('"Sick","approved","Flu"');
	});
});

describe('buildPayrollExportFilename', () => {
	it('includes project slug and format suffix', () => {
		expect(
			buildPayrollExportFilename({
				from: '2026-06-10',
				to: '2026-06-16',
				projectName: 'Riverside Office',
				format: 'summary'
			})
		).toBe('fuchsbau-payroll_riverside-office_2026-06-10_2026-06-16_summary.csv');
	});
});