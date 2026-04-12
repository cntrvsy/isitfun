import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
// import type { PageServerLoad } from './$types';
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
