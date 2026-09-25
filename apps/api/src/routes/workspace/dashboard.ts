import { Hono } from 'hono';
import { eq, and, inArray, desc, or, isNull, sql, lt } from 'drizzle-orm';
import { createD1Client, schema } from '@isitfun/db';
import type { AppEnv } from '../../types';
import { sessionMiddleware, requireAuth } from '../../middleware/auth';
import { ensurePersonalOrganization, getUserPersonalOrg } from '../../lib/orgs';

export const dashboardRouter = new Hono<AppEnv>()
	.use('*', sessionMiddleware, requireAuth)
	// GET /v1/dashboard - Retrieve aggregated dashboard workspace payload
	.get('/', async (c) => {
	const user = c.get('user')!;
	const db = createD1Client(c.env.DB);

	// 0. Ensure user has a personal organization
	await ensurePersonalOrganization(db, user);

	// 1. Fetch user's organizations with members and invites
	const memberships = await db.query.organizationMemberships.findMany({
		where: eq(schema.organizationMemberships.userId, user.id),
		with: {
			organization: {
				with: {
					memberships: {
						with: {
							user: true
						}
					},
					invites: true
				}
			}
		}
	});

	const userOrgs = memberships.map((m) => ({
		...m.organization,
		userRole: m.role
	}));

	const orgIds = userOrgs.map((o) => o.id);

	// 2. Fetch projects (scoped uniformly by organization memberships)
	const userProjects =
		orgIds.length > 0
			? await db.query.projects.findMany({
					where: inArray(schema.projects.organizationId, orgIds),
					with: {
						projectQuotas: true,
						payments: true
					}
				})
			: [];

	// 3. Ensure user has interactive Demo project scoped to their personal organization
	const demoProjectId = `demo_${user.id}`;
	const personalOrg = await getUserPersonalOrg(db, user);
	let demoProject = await db.query.projects.findFirst({
		where: eq(schema.projects.id, demoProjectId),
		with: {
			projectQuotas: true,
			payments: true
		}
	});

	if (!demoProject) {
		try {
			await db
				.insert(schema.projects)
				.values({
					id: demoProjectId,
					userId: user.id,
					organizationId: personalOrg.id,
					name: '🏓 Interactive Demo (Ping Pong)',
					tier: 'free',
					passwordProtected: false,
					createdAt: new Date()
				})
				.onConflictDoNothing()
				.run();

			demoProject = await db.query.projects.findFirst({
				where: eq(schema.projects.id, demoProjectId),
				with: {
					projectQuotas: true,
					payments: true
				}
			});
		} catch (e) {
			console.error('[Dashboard] Failed to auto-create demo project:', e);
		}
	} else if (!demoProject.organizationId) {
		await db
			.update(schema.projects)
			.set({ organizationId: personalOrg.id })
			.where(eq(schema.projects.id, demoProjectId));
		demoProject.organizationId = personalOrg.id;
	}

	if (demoProject && !userProjects.some((p) => p.id === demoProject.id)) {
		userProjects.unshift(demoProject);
	}

	// 4. Fetch recent sessions and aggregate session & log counts
	const projectIds = userProjects.map((p) => p.id);
	let recentSessions: Array<typeof schema.telemetrySessions.$inferSelect> = [];
	const sessionCounts: Record<string, number> = {};
	const logCounts: Record<string, number> = {};

	if (projectIds.length > 0) {
		recentSessions = await db
			.select()
			.from(schema.telemetrySessions)
			.where(inArray(schema.telemetrySessions.projectId, projectIds))
			.orderBy(desc(schema.telemetrySessions.createdAt))
			.limit(30)
			.all();

		const statsResult = await db
			.select({
				projectId: schema.telemetrySessions.projectId,
				totalSessions: sql<number>`count(*)`,
				totalEvents: sql<number>`coalesce(sum(${schema.telemetrySessions.logCount}), 0)`
			})
			.from(schema.telemetrySessions)
			.where(inArray(schema.telemetrySessions.projectId, projectIds))
			.groupBy(schema.telemetrySessions.projectId)
			.all();

		for (const row of statsResult) {
			sessionCounts[row.projectId] = Number(row.totalSessions || 0);
			logCounts[row.projectId] = Number(row.totalEvents || 0);
		}
	}

	const projectsWithStats = userProjects.map((project) => ({
		...project,
		stats: {
			totalSessions: sessionCounts[project.id] || 0,
			totalEvents: logCounts[project.id] || 0
		}
	}));

	// 5. Multi-Tiered Log Decay Routine (throttled background execution)
	if (c.executionCtx?.waitUntil && Math.random() < 0.05) {
		const bucket = c.env.GAMES_BUCKET;
		const now = Date.now();
		const freeProjectIds = userProjects
			.filter((p) => !p.organizationId && (p.tier || 'free') === 'free')
			.map((p) => p.id);
		const proProjectIds = userProjects
			.filter((p) => !p.organizationId && p.tier === 'pro')
			.map((p) => p.id);
		const teamProjectIds = userProjects.filter((p) => Boolean(p.organizationId)).map((p) => p.id);

		const cleanupRoutine = async () => {
			try {
				const thresholds: Array<{ ids: string[]; date: Date }> = [];
				if (freeProjectIds.length > 0) {
					thresholds.push({ ids: freeProjectIds, date: new Date(now - 7 * 24 * 60 * 60 * 1000) });
				}
				if (proProjectIds.length > 0) {
					thresholds.push({ ids: proProjectIds, date: new Date(now - 30 * 24 * 60 * 60 * 1000) });
				}
				if (teamProjectIds.length > 0) {
					thresholds.push({ ids: teamProjectIds, date: new Date(now - 90 * 24 * 60 * 60 * 1000) });
				}

				for (const item of thresholds) {
					const expiredSessions = await db
						.select({ id: schema.telemetrySessions.id, projectId: schema.telemetrySessions.projectId })
						.from(schema.telemetrySessions)
						.where(
							and(
								lt(schema.telemetrySessions.createdAt, item.date),
								inArray(schema.telemetrySessions.projectId, item.ids)
							)
						)
						.all();

					if (expiredSessions.length > 0) {
						if (bucket) {
							const keysToDelete = expiredSessions.map(
								(sess) => `games/${sess.projectId}/sessions/${sess.id}.json`
							);
							try {
								await bucket.delete(keysToDelete);
							} catch (r2Err) {
								console.error('[R2 Session Cleanup] Batch delete failed:', r2Err);
							}
						}

						const expiredIds = expiredSessions.map((s) => s.id);
						await db
							.delete(schema.telemetrySessions)
							.where(inArray(schema.telemetrySessions.id, expiredIds));
					}
				}
			} catch (err) {
				console.error('[Log Decay Cleanup Routine] Error:', err);
			}
		};

		c.executionCtx.waitUntil(cleanupRoutine());
	}

	return c.json({
		projects: projectsWithStats,
		organizations: userOrgs,
		recentSessions
	});
});
