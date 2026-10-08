import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getApiBaseUrl } from '#lib/api/config.js';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		if (event.locals.user.role === 'admin') {
			return redirect(302, '/portal/admin');
		} else {
			return redirect(302, '/portal/dashboard');
		}
	}
	return {};
};

export const actions: Actions = {
	signOut: async (event) => {
		const baseUrl = getApiBaseUrl(event.platform);
		await fetch(`${baseUrl}/v1/auth/sign-out`, {
			method: 'POST',
			headers: { cookie: event.request.headers.get('cookie') || '' }
		}).catch(() => {});

		event.cookies.delete('better-auth.session_token', { path: '/' });
		return redirect(302, '/auth');
	}
};
