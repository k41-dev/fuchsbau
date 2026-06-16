export const ABSENCE_TYPES = ['sick', 'vacation'] as const;
export type AbsenceType = (typeof ABSENCE_TYPES)[number];

export function todayString(): string {
	return new Date().toISOString().slice(0, 10);
}

export function eachDateInRange(start: string, end: string): string[] {
	const dates: string[] = [];
	const current = new Date(`${start}T12:00:00`);
	const last = new Date(`${end}T12:00:00`);

	if (current > last) return dates;

	while (current <= last) {
		dates.push(current.toISOString().slice(0, 10));
		current.setDate(current.getDate() + 1);
	}

	return dates;
}