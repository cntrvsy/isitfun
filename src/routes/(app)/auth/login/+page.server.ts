import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		if (event.locals.user.role === 'admin') {
			return redirect(302, '/portal/admin');
		} else if (event.locals.user.role === 'game_developer') {
			return redirect(302, '/portal/dashboard');
		}
	}
};
export const actions: Actions = {
	signInSocial: async (event) => {
		const formData = await event.request.formData();
		const provider = formData.get('provider')?.toString() ?? 'github';
		const callbackURL = formData.get('callbackURL')?.toString() ?? '/auth';

		const result = await event.locals.auth.api.signInSocial({
			body: {
				provider: provider as 'github' | 'google',
				callbackURL
			}
		});

		if (result.url) {
			return redirect(302, result.url);
		}
		return fail(400, { message: 'Social sign-in failed' });
	}
};
