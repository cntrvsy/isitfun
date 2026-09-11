import { hc } from 'hono/client';
import type { AppType } from '@isitfun/api';

export function createApiClient(
	fetchFn: typeof fetch = fetch,
	baseUrl: string = 'http://localhost:8787'
) {
	return hc<AppType>(baseUrl, {
		fetch: fetchFn,
		init: {
			credentials: 'include'
		}
	});
}

export type ApiClient = ReturnType<typeof createApiClient>;
