import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eq, lt, and, inArray, desc, or, isNull, sql } from 'drizzle-orm';
import { projects, telemetrySessions, organizationMemberships } from '#lib/server/db/db-schema.js';

import { resolvePendingInvite } from '#lib/server/invites.js';

export const load: PageServerLoad = async ({ locals, cookies, platform }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		throw redirect(302, '/auth');
	}

	const db = locals.db as ReturnType<typeof import('#lib/server/db/index.js').createD1Client>;

	// Resolve pending organization invites
	await resolvePendingInvite(db, cookies, user.id);

	// Fetch user's organizations
	const memberships = await db.query.organizationMemberships.findMany({
		where: eq(organizationMemberships.userId, user.id),
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

	// Load projects (Personal + Org memberships)
	const userProjects = await db.query.projects.findMany({
		where:
			orgIds.length > 0
				? or(
						and(eq(projects.userId, user.id), isNull(projects.organizationId)),
						inArray(projects.organizationId, orgIds)
					)
				: and(eq(projects.userId, user.id), isNull(projects.organizationId)),
		with: {
			projectQuotas: true,
			payments: true
		}
	});

	// Ensure the user has their personal Demo project available so demo playtest telemetry is tied to their workspace
	const demoProjectId = `demo_${user.id}`;
	let demoProject = await db.query.projects.findFirst({
		where: eq(projects.id, demoProjectId),
		with: {
			projectQuotas: true,
			payments: true
		}
	});

	if (!demoProject) {
		try {
			await db
				.insert(projects)
				.values({
					id: demoProjectId,
					userId: user.id,
					name: '🏓 Interactive Demo (Ping Pong)',
					tier: 'free',
					passwordProtected: false,
					createdAt: new Date()
				})
				.onConflictDoNothing()
				.run();

			demoProject = await db.query.projects.findFirst({
				where: eq(projects.id, demoProjectId),
				with: {
					projectQuotas: true,
					payments: true
				}
			});
		} catch (e) {
			console.error('Failed to auto-create demo project:', e);
		}
	}

	if (demoProject && !userProjects.some((p) => p.id === demoProject.id)) {
		userProjects.unshift(demoProject);
	}

	// Fetch session and log counts along with recent events for live tail inspector
	const projectIds = userProjects.map((p) => p.id);
	let recentSessions: Array<typeof telemetrySessions.$inferSelect> = [];
	const sessionCounts: Record<string, number> = {};
	const logCounts: Record<string, number> = {};

	if (projectIds.length > 0) {
		recentSessions = await db
			.select()
			.from(telemetrySessions)
			.where(inArray(telemetrySessions.projectId, projectIds))
			.orderBy(desc(telemetrySessions.createdAt))
			.limit(30)
			.all();

		const statsResult = await db
			.select({
				projectId: telemetrySessions.projectId,
				totalSessions: sql<number>`count(*)`,
				totalEvents: sql<number>`coalesce(sum(${telemetrySessions.logCount}), 0)`
			})
			.from(telemetrySessions)
			.where(inArray(telemetrySessions.projectId, projectIds))
			.groupBy(telemetrySessions.projectId)
			.all();

		for (const row of statsResult) {
			sessionCounts[row.projectId] = Number(row.totalSessions || 0);
			logCounts[row.projectId] = Number(row.totalEvents || 0);
		}
	}

	const projectsWithStats = userProjects.map((project) => {
		const totalSessions = sessionCounts[project.id] || 0;
		const totalEvents = logCounts[project.id] || 0;

		return {
			...project,
			stats: {
				totalSessions,
				totalEvents
			}
		};
	});

	// Defensive Shield 2: Multi-Tiered Log Decay Protocol & R2 Storage Cleanup (Throttled to ~5% of loads)
	if (platform?.ctx?.waitUntil && Math.random() < 0.05) {
		const bucket = platform?.env?.GAMES_BUCKET;
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
						.select({ id: telemetrySessions.id, projectId: telemetrySessions.projectId })
						.from(telemetrySessions)
						.where(
							and(
								lt(telemetrySessions.createdAt, item.date),
								inArray(telemetrySessions.projectId, item.ids)
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
						await db.delete(telemetrySessions).where(inArray(telemetrySessions.id, expiredIds));
					}
				}
			} catch (err) {
				console.error('[Log Decay Cleanup Routine] Failed:', err);
			}
		};

		platform.ctx.waitUntil(cleanupRoutine());
	}

	return {
		projects: projectsWithStats,
		organizations: userOrgs,
		recentSessions,
		user
	};
};
