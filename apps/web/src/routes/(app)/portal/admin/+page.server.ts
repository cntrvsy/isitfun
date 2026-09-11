import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = locals.session;
	const activeUser = locals.user;

	if (!session || !activeUser || activeUser.role !== 'admin') {
		throw redirect(302, '/auth');
	}

	const res = await locals.api.v1.admin.stats.$get();
	if (!res.ok) {
		console.error('Failed to load system stats for admin:', res.status);
		return {
			stats: {
				totalProjects: 0,
				totalSessions: 0,
				totalLogs: 0,
				totalUsers: 0
			},
			roleDistribution: []
		};
	}

	const data = await res.json();
	return {
		stats: data.stats,
		roleDistribution: data.roleDistribution
	};
};
