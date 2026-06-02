import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eq, lt, and, inArray } from 'drizzle-orm';
import { projects, telemetryLogs } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals, platform }) => {
	const session = locals.session;
	const user = locals.user;
	
	if (!session || !user) {
		throw redirect(302, '/auth/login');
	}

	const userProjects = await locals.db
		.select()
		.from(projects)
		.where(eq(projects.userId, user.id))
		.all();

	// Defensive Shield 2: 7-Day Log Decay Protocol for Free tier projects
	const wait = platform?.ctx?.waitUntil;
	if (wait) {
		const freeProjectIds = userProjects.filter((p) => p.tier === 'free').map((p) => p.id);
		if (freeProjectIds.length > 0) {
			const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
			wait(
				locals.db
					.delete(telemetryLogs)
					.where(
						and(
							lt(telemetryLogs.timestamp, oneWeekAgo),
							inArray(telemetryLogs.projectId, freeProjectIds)
						)
					)
			);
		}
	}

	return {
		projects: userProjects
	};
};
