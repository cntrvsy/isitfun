import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		throw redirect(302, '/auth');
	}

	const res = await locals.api.v1.dashboard.$get();
	if (!res.ok) {
		console.error('[Dashboard Load] Failed to fetch dashboard data:', res.status);
		return {
			projects: [],
			organizations: [],
			recentSessions: [],
			user
		};
	}

	const data = await res.json();

	return {
		projects: data.projects,
		organizations: data.organizations,
		recentSessions: data.recentSessions,
		user
	};
};
