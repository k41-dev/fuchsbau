import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { breakPeriod } from '../db/schema';

export class DrizzleBreakRepository {
	async findOpenByTimeEntryId(timeEntryId: number) {
		const [row] = await db
			.select()
			.from(breakPeriod)
			.where(and(eq(breakPeriod.timeEntryId, timeEntryId), isNull(breakPeriod.endTime)))
			.limit(1);
		return row ?? null;
	}

	async findByTimeEntryId(timeEntryId: number) {
		return db.select().from(breakPeriod).where(eq(breakPeriod.timeEntryId, timeEntryId));
	}

	async start(timeEntryId: number): Promise<typeof breakPeriod.$inferSelect> {
		const [row] = await db
			.insert(breakPeriod)
			.values({ timeEntryId, startTime: new Date() })
			.returning();
		return row;
	}

	async end(breakId: number, endTime: Date = new Date()) {
		const [open] = await db.select().from(breakPeriod).where(eq(breakPeriod.id, breakId)).limit(1);
		if (!open) throw new Error('Break not found');

		const duration = Math.floor((endTime.getTime() - open.startTime.getTime()) / 1000);
		const [row] = await db
			.update(breakPeriod)
			.set({ endTime, duration })
			.where(eq(breakPeriod.id, breakId))
			.returning();
		return row;
	}

	async closeOpenBreaks(timeEntryId: number, endTime: Date = new Date()) {
		const open = await this.findOpenByTimeEntryId(timeEntryId);
		if (open) await this.end(open.id, endTime);
	}

	async getTotalBreakSeconds(timeEntryId: number, includeOpenBreak = false): Promise<number> {
		const breaks = await this.findByTimeEntryId(timeEntryId);
		let total = 0;

		for (const b of breaks) {
			if (b.duration) {
				total += b.duration;
			} else if (includeOpenBreak && !b.endTime) {
				total += Math.floor((Date.now() - b.startTime.getTime()) / 1000);
			}
		}

		return total;
	}
}