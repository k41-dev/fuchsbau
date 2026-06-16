export class Project {
	constructor(
		public readonly id: number | null,
		public readonly name: string,
		public readonly description: string | null,
		public readonly address: string | null,
		public readonly color: string | null,
		public readonly userId: string,
		public readonly createdAt: Date,
		public readonly updatedAt: Date
	) {}

	toRecord() {
		return {
			id: this.id!,
			name: this.name,
			description: this.description,
			address: this.address,
			color: this.color,
			userId: this.userId,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt
		};
	}

	static create(params: {
		name: string;
		description?: string | null;
		address?: string | null;
		color?: string | null;
		userId: string;
	}): Project {
		const now = new Date();
		return new Project(
			null,
			params.name.trim(),
			params.description?.trim() || null,
			params.address?.trim() || null,
			params.color ?? '#3b82f6',
			params.userId,
			now,
			now
		);
	}
}