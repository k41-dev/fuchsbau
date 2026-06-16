export function parseLocalDateTimeInput(
	value: string | null | undefined,
	label: string
): Date {
	if (!value?.trim()) {
		throw new Error(`${label} is required`);
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid ${label}`);
	}

	return date;
}

export function toLocalDateTimeInputValue(iso: string | Date): string {
	const date = typeof iso === 'string' ? new Date(iso) : iso;
	const pad = (n: number) => String(n).padStart(2, '0');

	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}