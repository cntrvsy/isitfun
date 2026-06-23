import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/auth/login');
	}
	if (event.locals.user.role === 'admin') {
		return redirect(302, '/portal/admin');
	} else if (event.locals.user.role === 'game_developer') {
		return redirect(302, '/portal/dashboard');
	}
	return { user: event.locals.user };
};

export const actions: Actions = {
	signOut: async (event) => {
		await event.locals.auth.api.signOut({
			headers: event.request.headers
		});
		return redirect(302, '/auth/login');
	}
};
