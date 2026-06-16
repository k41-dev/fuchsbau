const PUBLIC_PATHS = new Set(['/', '/login', '/register']);

const PUBLIC_PREFIXES = ['/api/auth'];

const PUBLIC_FILES = new Set(['/manifest.webmanifest', '/manifest.json', '/sw.js', '/pwa-icon.svg']);

export function isPublicRoute(pathname: string): boolean {
	if (PUBLIC_PATHS.has(pathname)) return true;
	if (PUBLIC_FILES.has(pathname)) return true;
	if (pathname.startsWith('/workbox-')) return true;
	if (pathname.startsWith('/~') || pathname.startsWith('/@')) return true;
	return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function getLoginRedirect(pathname: string, search: string): string {
	const returnTo = `${pathname}${search}`;
	if (!returnTo || returnTo === '/' || returnTo.startsWith('/login') || returnTo.startsWith('/register')) {
		return '/login';
	}

	return `/login?redirectTo=${encodeURIComponent(returnTo)}`;
}

export function resolveRedirectTarget(redirectTo: string | null | undefined): string {
	if (!redirectTo || !redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
		return '/';
	}

	if (redirectTo.startsWith('/login') || redirectTo.startsWith('/register')) {
		return '/';
	}

	return redirectTo;
}