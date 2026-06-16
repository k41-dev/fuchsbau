export class Role {
  constructor(
    public readonly id: number | null,
    public readonly projectId: number,
    public readonly name: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  toRecord() {
    return {
      id: this.id!,
      projectId: this.projectId,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static create(params: {
    projectId: number;
    name: string;
  }): Role {
    const now = new Date();
    return new Role(
      null,
      params.projectId,
      params.name.trim(),
      now,
      now
    );
  }
}