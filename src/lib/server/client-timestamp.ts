const MAX_PAST_MS = 48 * 60 * 60 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;

export function parseClientTimestamp(value?: string): Date | undefined {
	if (!value) return undefined;

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error('Invalid clientTimestamp');
	}

	const now = Date.now();
	if (date.getTime() < now - MAX_PAST_MS) {
		throw new Error('clientTimestamp is too far in the past');
	}
	if (date.getTime() > now + MAX_FUTURE_MS) {
		throw new Error('clientTimestamp is in the future');
	}

	return date;
}