import { redirect } from '@sveltejs/kit';
import type { DrizzleClient } from '$lib/server/db';
import type { PageServerLoad } from './$types';
import { eq, lt, and, inArray, desc, or, isNull } from 'drizzle-orm';
import {
	projects,
	telemetrySessions,
	organizations,
	organizationMemberships,
	organizationInvites
} from '$lib/server/db/db-schema';

// Helper to sync seats with Creem subscription (inline duplicate of the helper for safety)
async function syncCreemSubscriptionSeats(db: DrizzleClient, orgId: string) {
	const org = await db.select().from(organizations).where(eq(organizations.id, orgId)).get();
	if (!org || !org.creemSubscriptionId) return;

	const memberships = await db
		.select()
		.from(organizationMemberships)
		.where(eq(organizationMemberships.organizationId, orgId))
		.all();

	const invites = await db
		.select()
		.from(organizationInvites)
		.where(eq(organizationInvites.organizationId, orgId))
		.all();

	const totalSeats = memberships.length + invites.length;
	const creemApiKey = process.env.CREEM_API_KEY;

	if (creemApiKey) {
		try {
			const res = await fetch(`https://api.creem.io/v1/subscriptions/${org.creemSubscriptionId}`, {
				headers: { 'x-api-key': creemApiKey }
			});
			if (res.ok) {
				const subData = (await res.json()) as { items?: Array<{ id: string }> };
				const itemId = subData.items?.[0]?.id;
				if (itemId) {
					await fetch(`https://api.creem.io/v1/subscriptions/${org.creemSubscriptionId}`, {
						method: 'PATCH',
						headers: {
							'x-api-key': creemApiKey,
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							items: [{ id: itemId, units: totalSeats }]
						})
					});
				}
			}
		} catch (err) {
			console.error('[Creem Sync in Load] Failed to sync seats:', err);
		}
	}
}

export const load: PageServerLoad = async ({ locals, cookies, platform }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		throw redirect(302, '/auth/login');
	}

	const db = locals.db as ReturnType<typeof import('$lib/server/db').createD1Client>;

	// Resolve pending organization invites
	const inviteToken = cookies.get('pending_invite_token');
	if (inviteToken) {
		try {
			const invite = await db
				.select()
				.from(organizationInvites)
				.where(eq(organizationInvites.token, inviteToken))
				.get();

			if (invite && new Date() <= invite.expiresAt) {
				// Check if membership already exists
				const existing = await db
					.select()
					.from(organizationMemberships)
					.where(
						and(
							eq(organizationMemberships.organizationId, invite.organizationId),
							eq(organizationMemberships.userId, user.id)
						)
					)
					.get();

				if (!existing) {
					await db.insert(organizationMemberships).values({
						id: crypto.randomUUID(),
						organizationId: invite.organizationId,
						userId: user.id,
						role: 'member',
						createdAt: new Date()
					});

					// Sync seats
					await syncCreemSubscriptionSeats(db, invite.organizationId);
				}

				// Delete the invite token
				await db.delete(organizationInvites).where(eq(organizationInvites.id, invite.id));
			}
		} catch (err) {
			console.error('Failed to process pending invitation token:', err);
		} finally {
			cookies.delete('pending_invite_token', { path: '/' });
		}
	}

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

		const sessionList = await db
			.select({ projectId: telemetrySessions.projectId, logCount: telemetrySessions.logCount })
			.from(telemetrySessions)
			.where(inArray(telemetrySessions.projectId, projectIds))
			.all();
		for (const s of sessionList) {
			sessionCounts[s.projectId] = (sessionCounts[s.projectId] || 0) + 1;
			logCounts[s.projectId] = (logCounts[s.projectId] || 0) + s.logCount;
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

	// Defensive Shield 2: Multi-Tiered Log Decay Protocol & R2 Storage Cleanup
	const wait = platform?.ctx?.waitUntil;
	if (wait) {
		const bucket = platform?.env?.GAMES_BUCKET;
		const now = Date.now();
		const freeProjectIds = userProjects
			.filter((p) => !p.organizationId && (p.tier || 'free') === 'free')
			.map((p) => p.id);
		const proProjectIds = userProjects
			.filter((p) => !p.organizationId && p.tier === 'pro')
			.map((p) => p.id);
		const teamProjectIds = userProjects
			.filter((p) => Boolean(p.organizationId))
			.map((p) => p.id);

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
							for (const sess of expiredSessions) {
								try {
									await bucket.delete(`games/${sess.projectId}/sessions/${sess.id}.json`);
								} catch (r2Err) {
									console.error(
										`[R2 Session Cleanup] Failed to delete R2 log file for session ${sess.id}:`,
										r2Err
									);
								}
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

		wait(cleanupRoutine());
	}

	return {
		projects: projectsWithStats,
		organizations: userOrgs,
		recentSessions,
		user
	};
};
