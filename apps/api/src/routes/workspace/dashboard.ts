import { Hono } from 'hono';
import { eq, inArray, desc, sql } from 'drizzle-orm';
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

		return c.json({
			projects: projectsWithStats,
			organizations: userOrgs,
			recentSessions
		});
	});
