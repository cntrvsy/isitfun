import type { Cookies } from '@sveltejs/kit';
import type { DrizzleClient } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import {
	organizationInvites,
	organizationMemberships,
	organizations
} from '$lib/server/db/db-schema';
import { env } from '$env/dynamic/private';

// Helper to sync seats with Creem subscription
export async function syncCreemSubscriptionSeats(db: DrizzleClient, orgId: string) {
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
	const creemApiKey = env.CREEM_API_KEY;
	const isTestMode = env.CREEM_TEST_MODE !== 'false';
	const baseUrl = isTestMode ? 'https://test-api.creem.io/v1' : 'https://api.creem.io/v1';

	if (creemApiKey) {
		try {
			const res = await fetch(`${baseUrl}/subscriptions/${org.creemSubscriptionId}`, {
				headers: { 'x-api-key': creemApiKey }
			});
			if (res.ok) {
				const subData = (await res.json()) as { items?: Array<{ id: string }> };
				const itemId = subData.items?.[0]?.id;
				if (itemId) {
					await fetch(`${baseUrl}/subscriptions/${org.creemSubscriptionId}`, {
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
			console.error('[Creem Sync] Failed to sync seats:', err);
		}
	}
}

/**
 * Universal helper to resolve pending organization invite cookies upon user authentication.
 */
export async function resolvePendingInvite(db: DrizzleClient, cookies: Cookies, userId: string) {
	const inviteToken = cookies.get('pending_invite_token');
	if (!inviteToken) return;

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
						eq(organizationMemberships.userId, userId)
					)
				)
				.get();

			if (!existing) {
				await db.insert(organizationMemberships).values({
					id: crypto.randomUUID(),
					organizationId: invite.organizationId,
					userId: userId,
					role: 'member',
					createdAt: new Date()
				});

				// Sync seats with Creem
				await syncCreemSubscriptionSeats(db, invite.organizationId);
			}

			// Delete the invite token record
			await db.delete(organizationInvites).where(eq(organizationInvites.id, invite.id));
		}
	} catch (err) {
		console.error('[Invite Resolution] Failed to process pending invitation token:', err);
	} finally {
		cookies.delete('pending_invite_token', { path: '/' });
	}
}
