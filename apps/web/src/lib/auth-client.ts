import { createAuthClient } from 'better-auth/svelte';

/**
 * First-party Better-Auth client.
 * In the browser, points to window.location.origin with basePath: '/v1/auth',
 * which routes transparently through hooks.server.ts handleGateway to apps/api.
 */
export const authClient = createAuthClient({
	baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8787',
	basePath: '/v1/auth'
});
