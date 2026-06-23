import { redirect } from '@sveltejs/kit';
import type { DrizzleClient } from '$lib/server/db';
import type { PageServerLoad } from './$types';
import { eq, lt, and, inArray, desc, or, isNull } from 'drizzle-orm';
import {
	projects,
	telemetrySessions,
	customDeveloperLogs,
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
	let recentLogs: Array<typeof customDeveloperLogs.$inferSelect> = [];
	const sessionCounts: Record<string, number> = {};
	const logCounts: Record<string, number> = {};

	if (projectIds.length > 0) {
		recentLogs = await db
			.select()
			.from(customDeveloperLogs)
			.where(inArray(customDeveloperLogs.projectId, projectIds))
			.orderBy(desc(customDeveloperLogs.createdAt))
			.limit(50)
			.all();

		const sessionList = await db
			.select({ projectId: telemetrySessions.projectId })
			.from(telemetrySessions)
			.where(inArray(telemetrySessions.projectId, projectIds))
			.all();
		for (const s of sessionList) {
			sessionCounts[s.projectId] = (sessionCounts[s.projectId] || 0) + 1;
		}

		const logList = await db
			.select({ projectId: customDeveloperLogs.projectId })
			.from(customDeveloperLogs)
			.where(inArray(customDeveloperLogs.projectId, projectIds))
			.all();
		for (const l of logList) {
			logCounts[l.projectId] = (logCounts[l.projectId] || 0) + 1;
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

	// Defensive Shield 2: 7-Day Log Decay Protocol for Free tier projects
	const wait = platform?.ctx?.waitUntil;
	if (wait) {
		const freeProjectIds = userProjects.filter((p) => p.tier === 'free').map((p) => p.id);
		if (freeProjectIds.length > 0) {
			const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
			wait(
				db
					.delete(customDeveloperLogs)
					.where(
						and(
							lt(customDeveloperLogs.createdAt, oneWeekAgo),
							inArray(customDeveloperLogs.projectId, freeProjectIds)
						)
					)
			);
		}
	}

	return {
		projects: projectsWithStats,
		organizations: userOrgs,
		recentLogs,
		user
	};
};
