import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const token = event.url.searchParams.get('token');
	if (token) {
		try {
			await event.locals.auth.api.verifyEmail({
				query: { token }
			});
			return { verified: true };
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
