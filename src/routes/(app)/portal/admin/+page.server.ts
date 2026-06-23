import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { sql } from 'drizzle-orm';
import { projects, telemetrySessions, customDeveloperLogs, user } from '$lib/server/db/db-schema';

export const load: PageServerLoad = async ({ locals }) => {
	// Double check admin role authorization (even though hooks guards this, defense-in-depth is excellent)
	const session = locals.session;
	const activeUser = locals.user;

	if (!session || !activeUser || activeUser.role !== 'admin') {
		throw redirect(302, '/auth/login');
	}

	try {
		// Aggregate global platform stats
		const db = locals.db as ReturnType<typeof import('$lib/server/db').createD1Client>;

		const projectsCountResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(projects)
			.get();

		const sessionsCountResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(telemetrySessions)
			.get();

		const logsCountResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(customDeveloperLogs)
			.get();

		const usersCountResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(user)
			.get();

		// Fetch user role distributions
		const roleDistribution = (await db
			.select({
				role: user.role,
				count: sql<number>`count(*)`
			})
			.from(user)
			.groupBy(user.role)
			.all()) as unknown as { role: 'game_developer' | 'admin'; count: number }[];

		return {
			stats: {
				totalProjects: projectsCountResult?.count || 0,
				totalSessions: sessionsCountResult?.count || 0,
				totalLogs: logsCountResult?.count || 0,
				totalUsers: usersCountResult?.count || 0
			},
			roleDistribution: roleDistribution || []
		};
	} catch (error) {
		console.error('Failed to load system stats for admin:', error);
		// Return fallback state if tables don't have records yet
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
};
