import { inArray, sql } from 'drizzle-orm';
import { db } from '../../infrastructure/db/client';
import { timeEntryCorrection } from '../../infrastructure/db/schema';

export async function getCorrectionCountsByEntry(
	entryIds: number[]
): Promise<Map<number, number>> {
	if (entryIds.length === 0) return new Map();

	const rows = await db
		.select({
			timeEntryId: timeEntryCorrection.timeEntryId,
			count: sql<number>`count(*)::int`
		})
		.from(timeEntryCorrection)
		.where(inArray(timeEntryCorrection.timeEntryId, entryIds))
		.groupBy(timeEntryCorrection.timeEntryId);

	return new Map(rows.map((row) => [row.timeEntryId, row.count]));
}