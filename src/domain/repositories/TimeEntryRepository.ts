import type { TimeEntry } from '../entities/TimeEntry';

export interface TimeEntryRepository {
  findById(id: number): Promise<TimeEntry | null>;
  findActiveByUserId(userId: string): Promise<TimeEntry | null>;
  findActiveByProjectId(projectId: number): Promise<TimeEntry[]>;
  findByUserId(userId: string, limit?: number): Promise<TimeEntry[]>;
  save(timeEntry: TimeEntry): Promise<TimeEntry>;
  update(timeEntry: TimeEntry): Promise<TimeEntry>;
  delete(id: number): Promise<void>;
}