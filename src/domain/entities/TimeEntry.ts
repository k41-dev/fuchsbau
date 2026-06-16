export class TimeEntry {
  constructor(
    public readonly id: number | null,
    public readonly userId: string,
    public readonly projectId: number | null,
    public readonly roleId: number | null,
    public readonly description: string | null,
    public readonly startTime: Date,
    public readonly endTime: Date | null,
    public readonly duration: number | null, // in seconds
    public readonly isRunning: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(params: {
    userId: string;
    projectId?: number | null;
    roleId?: number | null;
    description?: string | null;
    startTime: Date;
  }): TimeEntry {
    return new TimeEntry(
      null,
      params.userId,
      params.projectId ?? null,
      params.roleId ?? null,
      params.description ?? null,
      params.startTime,
      null,
      null,
      true,
      new Date(),
      new Date()
    );
  }

  stop(endTime: Date = new Date(), breakSeconds = 0): TimeEntry {
    if (!this.isRunning) {
      throw new Error('Time entry is already stopped');
    }

    const gross = Math.floor((endTime.getTime() - this.startTime.getTime()) / 1000);
    const duration = Math.max(0, gross - breakSeconds);

    return new TimeEntry(
      this.id,
      this.userId,
      this.projectId,
      this.roleId,
      this.description,
      this.startTime,
      endTime,
      duration,
      false,
      this.createdAt,
      new Date()
    );
  }
}