import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { createD1Client, schema } from '@isitfun/db';
import type { AppEnv } from '../types';
import { sessionMiddleware, requireAuth, requireRole } from '../middleware/auth';

export const adminRouter = new Hono<AppEnv>()
	.use('*', sessionMiddleware, requireAuth, requireRole('admin'))
	// GET /v1/admin/stats - Global system telemetry & user distributions
	.get('/stats', async (c) => {
	const db = createD1Client(c.env.DB);

	try {
		const projectsCountResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(schema.projects)
			.get();

		const sessionsCountResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(schema.telemetrySessions)
			.get();

		const logsCountResult = await db
			.select({ count: sql<number>`coalesce(sum(${schema.telemetrySessions.logCount}), 0)` })
			.from(schema.telemetrySessions)
			.get();

		const usersCountResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(schema.user)
			.get();

		const roleDistribution = (await db
			.select({
				role: schema.user.role,
				count: sql<number>`count(*)`
			})
			.from(schema.user)
			.groupBy(schema.user.role)
			.all()) as unknown as Array<{ role: 'game_developer' | 'admin'; count: number }>;

		return c.json({
			stats: {
				totalProjects: Number(projectsCountResult?.count || 0),
				totalSessions: Number(sessionsCountResult?.count || 0),
				totalLogs: Number(logsCountResult?.count || 0),
				totalUsers: Number(usersCountResult?.count || 0)
			},
			roleDistribution: roleDistribution || []
		});
	} catch (error) {
		console.error('[Admin] Failed to load system stats:', error);
		return c.json({
			stats: {
				totalProjects: 0,
				totalSessions: 0,
				totalLogs: 0,
				totalUsers: 0
			},
			roleDistribution: []
		});
	}
});
