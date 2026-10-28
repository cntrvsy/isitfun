import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.session || !locals.user) {
		redirect(302, '/auth');
	}

	const res = await locals.api.v1.profile.$get();
	const data = res.ok ? await res.json() : { profile: null };

	return {
		user: locals.user,
		profile: data.profile || null
	};
};
