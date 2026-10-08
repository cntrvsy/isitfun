import type { PageServerLoad } from './$types';
import { getApiBaseUrl } from '#lib/api/config.js';

export const load: PageServerLoad = async (event) => {
	const token = event.url.searchParams.get('token');
	if (token) {
		try {
			const baseUrl = getApiBaseUrl(event.platform);
			const res = await fetch(
				`${baseUrl}/v1/auth/verify-email?token=${encodeURIComponent(token)}`,
				{
					method: 'GET',
					headers: { cookie: event.request.headers.get('cookie') || '' }
				}
			);
			if (res.ok) {
				return { verified: true };
			}
			const data = (await res.json().catch(() => ({}))) as { message?: string };
			return {
				verified: false,
				error: data.message || 'Verification token is invalid or has expired.'
			};
		} catch (err: unknown) {
			console.error('[verify-email] Failed token verification:', err);
			return {
				verified: false,
				error: (err as Error)?.message || 'Verification token is invalid or has expired.'
			};
		}
	}

	return { verified: false };
};
