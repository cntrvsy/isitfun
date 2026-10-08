/**
 * Centralized API configuration and target resolution.
 * Supports transparent switching between local development workers,
 * live staging/production API, and in-memory Cloudflare Service Bindings.
 */

export function getApiBaseUrl(platform?: Readonly<App.Platform> | App.Platform): string {
	const isDev = import.meta.env.DEV;

	// In production at the Cloudflare edge, use 0ms Service Binding
	if (!isDev && platform?.env?.API) {
		return 'https://api.internal';
	}

	// In local development or standalone SSR, read configured API_BASE_URL
	return (
		(typeof process !== 'undefined' && process.env?.API_BASE_URL) ||
		(import.meta.env.API_BASE_URL as string) ||
		'http://localhost:8787'
	);
}

export function isConnectedToProduction(platform?: Readonly<App.Platform> | App.Platform): boolean {
	const url = getApiBaseUrl(platform);
	return url.includes('frstudios.co.ke') || (!import.meta.env.DEV && !url.includes('localhost'));
}
