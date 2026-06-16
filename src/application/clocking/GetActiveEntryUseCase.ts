import type { TimeEntryRepository } from '../../domain/repositories/TimeEntryRepository';
import type { TimeEntry } from '../../domain/entities/TimeEntry';

export class GetActiveEntryUseCase {
  constructor(private readonly timeEntryRepository: TimeEntryRepository) {}

  async execute(userId: string): Promise<TimeEntry | null> {
    return this.timeEntryRepository.findActiveByUserId(userId);
  }
}