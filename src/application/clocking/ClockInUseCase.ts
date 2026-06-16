import { eq, and } from 'drizzle-orm';
import type { TimeEntryRepository } from '../../domain/repositories/TimeEntryRepository';
import { TimeEntry } from '../../domain/entities/TimeEntry';
import { db } from '../../infrastructure/db/client';
import { absence } from '../../infrastructure/db/schema';

export class ClockInUseCase {
  constructor(private readonly timeEntryRepository: TimeEntryRepository) {}

  async execute(params: {
    userId: string;
    projectId?: number | null;
    roleId?: number | null;
    description?: string | null;
  }): Promise<TimeEntry> {
    const today = new Date().toISOString().slice(0, 10);
    const [todayAbsence] = await db
      .select()
      .from(absence)
      .where(and(eq(absence.userId, params.userId), eq(absence.date, today)))
      .limit(1);

    if (todayAbsence) {
      throw new Error('You have an absence today. Cancel it first if you are working.');
    }

    const activeEntry = await this.timeEntryRepository.findActiveByUserId(params.userId);
    if (activeEntry) {
      throw new Error('User already has an active time entry. Please clock out first.');
    }

    const newEntry = TimeEntry.create({
      userId: params.userId,
      projectId: params.projectId,
      roleId: params.roleId,
      description: params.description,
      startTime: new Date(),
    });

    return this.timeEntryRepository.save(newEntry);
  }
}