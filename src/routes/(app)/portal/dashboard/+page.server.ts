import { redirect } from '@sveltejs/kit';
import type { DrizzleClient } from '$lib/server/db';
import type { PageServerLoad } from './$types';
import { eq, lt, and, inArray, desc, or, isNull } from 'drizzle-orm';
import {
	projects,
	telemetryLogs,
	telemetrySessions,
	gameplayEvents,
	organizations,
	organizationMemberships,
	organizationInvites
} from '$lib/server/db/schema';

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

	const db = locals.db;

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

	// Fetch telemetry sessions and gameplay events for user's projects
	const projectIds = userProjects.map((p) => p.id);
	let sessions: Array<typeof telemetrySessions.$inferSelect> = [];
	let events: Array<typeof gameplayEvents.$inferSelect> = [];

	if (projectIds.length > 0) {
		sessions = await db
			.select()
			.from(telemetrySessions)
			.where(inArray(telemetrySessions.projectId, projectIds))
			.orderBy(desc(telemetrySessions.createdAt))
			.all();

		events = await db
			.select()
			.from(gameplayEvents)
			.where(inArray(gameplayEvents.projectId, projectIds))
			.orderBy(desc(gameplayEvents.timestamp))
			.all();
	}

	const projectsWithStats = userProjects.map((project) => {
		const projectSessions = sessions.filter((s) => s.projectId === project.id);
		const projectEvents = events.filter((e) => e.projectId === project.id);

		const totalSessions = projectSessions.length;
		const totalDuration = projectSessions.reduce((acc, s) => acc + (s.duration || 0), 0);
		const averageDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
		const totalEvents = projectEvents.length;

		const eventCountsMap: Record<string, number> = {};
		for (const e of projectEvents) {
			eventCountsMap[e.eventName] = (eventCountsMap[e.eventName] || 0) + 1;
		}
		const eventBreakdown = Object.entries(eventCountsMap)
			.map(([eventName, count]) => ({ eventName, count }))
			.sort((a, b) => b.count - a.count);

		return {
			...project,
			stats: {
				totalSessions,
				averageDuration,
				totalEvents,
				eventBreakdown
			},
			recentSessions: projectSessions.slice(0, 15),
			recentEvents: projectEvents.slice(0, 100)
		};
	});

	// Defensive Shield 2: 7-Day Log Decay Protocol for Free tier projects
	const wait = platform?.ctx?.waitUntil;
	if (wait) {
		const freeProjectIds = userProjects.filter((p) => p.tier === 'free').map((p) => p.id);
		if (freeProjectIds.length > 0) {
			const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
			wait(
				db
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
		projects: projectsWithStats,
		organizations: userOrgs,
		user
	};
};
