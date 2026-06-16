/** IndexedDB only accepts structured-cloneable plain data (not Svelte $state proxies). */
export function toPlainData<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}