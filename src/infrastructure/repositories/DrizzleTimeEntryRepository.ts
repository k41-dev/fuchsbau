import { eq, and, desc, gte } from 'drizzle-orm';
import { db } from '../db/client';
import { timeEntry, user, role as roleTable } from '../db/schema';
import type { TimeEntryRepository } from '../../domain/repositories/TimeEntryRepository';
import { TimeEntry } from '../../domain/entities/TimeEntry';

export class DrizzleTimeEntryRepository implements TimeEntryRepository {
  async findById(id: number): Promise<TimeEntry | null> {
    const result = await db
      .select()
      .from(timeEntry)
      .where(eq(timeEntry.id, id))
      .limit(1);

    return result[0] ? this.mapToEntity(result[0]) : null;
  }

  async findActiveByUserId(userId: string): Promise<TimeEntry | null> {
    const result = await db
      .select()
      .from(timeEntry)
      .where(
        and(
          eq(timeEntry.userId, userId),
          eq(timeEntry.isRunning, true)
        )
      )
      .limit(1);

    return result[0] ? this.mapToEntity(result[0]) : null;
  }

  async findActiveByProjectId(projectId: number): Promise<TimeEntry[]> {
    const results = await db
      .select()
      .from(timeEntry)
      .where(
        and(
          eq(timeEntry.projectId, projectId),
          eq(timeEntry.isRunning, true)
        )
      )
      .orderBy(desc(timeEntry.startTime));

    return results.map((row) => this.mapToEntity(row));
  }

  async findByUserId(userId: string, limit = 50): Promise<TimeEntry[]> {
    const results = await db
      .select()
      .from(timeEntry)
      .where(eq(timeEntry.userId, userId))
      .orderBy(desc(timeEntry.startTime))
      .limit(limit);

    return results.map((row) => this.mapToEntity(row));
  }

  async save(entry: TimeEntry): Promise<TimeEntry> {
    const [result] = await db
      .insert(timeEntry)
      .values({
        userId: entry.userId,
        projectId: entry.projectId,
        roleId: entry.roleId,
        description: entry.description,
        startTime: entry.startTime,
        endTime: entry.endTime,
        duration: entry.duration,
        isRunning: entry.isRunning,
      })
      .returning();

    return this.mapToEntity(result);
  }

  async update(entry: TimeEntry): Promise<TimeEntry> {
    if (!entry.id) {
      throw new Error('Cannot update TimeEntry without id');
    }

    const [result] = await db
      .update(timeEntry)
      .set({
        projectId: entry.projectId,
        roleId: entry.roleId,
        description: entry.description,
        startTime: entry.startTime,
        endTime: entry.endTime,
        duration: entry.duration,
        isRunning: entry.isRunning,
        updatedAt: new Date(),
      })
      .where(eq(timeEntry.id, entry.id))
      .returning();

    return this.mapToEntity(result);
  }

  async delete(id: number): Promise<void> {
    await db.delete(timeEntry).where(eq(timeEntry.id, id));
  }

  private mapToEntity(row: typeof timeEntry.$inferSelect): TimeEntry {
    return new TimeEntry(
      row.id,
      row.userId,
      row.projectId,
      row.roleId ?? null,
      row.description,
      row.startTime,
      row.endTime,
      row.duration,
      row.isRunning,
      row.createdAt,
      row.updatedAt
    );
  }
}