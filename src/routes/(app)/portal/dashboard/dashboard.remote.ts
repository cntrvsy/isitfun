import { form, getRequestEvent } from '$app/server';
import type { DrizzleClient } from '$lib/server/db';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { eq, and, isNull } from 'drizzle-orm';
import {
	projects,
	organizations,
	organizationMemberships,
	organizationInvites
} from '$lib/server/db/schema';
import { generateNanoID } from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';
import { hashPassword } from '$lib/server/crypto';

// Helper to sync seats with Creem subscription
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
	const creemApiKey = env.CREEM_API_KEY;

	if (creemApiKey) {
		try {
			// Fetch subscription from Creem to extract item ID
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
					console.log(
						`[Creem Sync] Successfully synced seat count of ${totalSeats} for org ${orgId}`
					);
				}
			}
		} catch (err) {
			console.error('[Creem Sync] Failed to sync Creem seats:', err);
		}
	}
}

export const createProject = form(
	v.object({
		name: v.pipe(v.string(), v.nonEmpty('Project name is required')),
		passwordProtected: v.optional(v.boolean(), false),
		password: v.optional(v.string()),
		organizationId: v.optional(v.string())
	}),
	async (data) => {
		const event = getRequestEvent();
		const { locals } = event;
		const { session, user, db } = locals;

		if (!session || !user) {
			error(401, 'Unauthorized');
		}

		let organizationId: string | null = null;

		if (data.organizationId) {
			// Verify user is a member of this organization
			const membership = await db
				.select()
				.from(organizationMemberships)
				.where(
					and(
						eq(organizationMemberships.organizationId, data.organizationId),
						eq(organizationMemberships.userId, user.id)
					)
				)
				.get();

			if (!membership) {
				error(403, 'Forbidden: You are not a member of this organization');
			}

			organizationId = data.organizationId;

			// Verify limits if org is on free tier
			const org = await db
				.select()
				.from(organizations)
				.where(eq(organizations.id, organizationId))
				.get();
			if (!org) {
				error(404, 'Organization not found');
			}

			if (org.tier !== 'team') {
				const activeFreeProjects = await db
					.select()
					.from(projects)
					.where(eq(projects.organizationId, organizationId))
					.all();

				if (activeFreeProjects.length >= 1) {
					error(
						400,
						'Free organizations are limited to 1 active project. Please upgrade to Team Plan.'
					);
				}
			}
		} else {
			// Solo Free Tier project count limit (max 1 active free project)
			const activeFreeProjects = await db
				.select()
				.from(projects)
				.where(
					and(
						eq(projects.userId, user.id),
						isNull(projects.organizationId),
						eq(projects.tier, 'free')
					)
				)
				.all();

			if (activeFreeProjects.length >= 1) {
				error(
					400,
					'Free tier is limited to 1 active project. Please delete your existing project or upgrade to a Project Pass to create more.'
				);
			}
		}

		try {
			const projectId = generateNanoID(12);
			let passwordHash: string | null = null;
			if (data.passwordProtected && data.password) {
				passwordHash = await hashPassword(data.password, projectId);
			}

			await db.insert(projects).values({
				id: projectId,
				userId: user.id,
				organizationId,
				name: data.name.trim(),
				passwordProtected: data.passwordProtected,
				passwordHash,
				tier: 'free',
				createdAt: new Date()
			});

			return { success: true };
		} catch (err) {
			console.error('Failed to create project:', err);
			error(500, 'Database insertion failed');
		}
	}
);

export const deleteProject = form(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty('Project ID is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		const { locals, platform } = event;
		const { session, user, db } = locals;

		if (!session || !user) {
			error(401, 'Unauthorized');
		}

		try {
			// Verify ownership or organization admin membership before deleting
			const project = await db.select().from(projects).where(eq(projects.id, data.id)).get();

			if (!project) {
				error(404, 'Project not found');
			}

			let hasAccess = project.userId === user.id;
			if (!hasAccess && project.organizationId) {
				const membership = await db
					.select()
					.from(organizationMemberships)
					.where(
						and(
							eq(organizationMemberships.organizationId, project.organizationId),
							eq(organizationMemberships.userId, user.id),
							eq(organizationMemberships.role, 'admin')
						)
					)
					.get();
				if (membership) {
					hasAccess = true;
				}
			}

			if (!hasAccess) {
				error(403, 'Forbidden: You do not have permission to delete this project');
			}

			// 1. Delete associated files in R2 GAMES_BUCKET
			const bucket = platform?.env.GAMES_BUCKET;
			if (bucket) {
				const prefix = `games/${data.id}/`;
				let truncated = true;
				let cursor: string | undefined = undefined;

				while (truncated) {
					const list = await bucket.list({ prefix, cursor });
					for (const obj of list.objects) {
						await bucket.delete(obj.key);
					}
					if (list.truncated) {
						cursor = list.cursor;
					}
					truncated = list.truncated;
				}
			}

			// 2. Delete project in D1 (cascade handles telemetry sessions and logs)
			await db.delete(projects).where(eq(projects.id, data.id));

			return { success: true };
		} catch (err) {
			console.error('Failed to delete project:', err);
			const message = err instanceof Error ? err.message : String(err);
			error(500, `Deletion failed: ${message}`);
		}
	}
);

export const upgradeProject = form(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty('Project ID is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		const { locals } = event;
		const { session, user, db } = locals;

		if (!session || !user) {
			error(401, 'Unauthorized');
		}

		// Verify project ownership
		const project = await db
			.select()
			.from(projects)
			.where(and(eq(projects.id, data.id), eq(projects.userId, user.id)))
			.get();

		if (!project) {
			error(404, 'Project not found');
		}

		const creemApiKey = env.CREEM_API_KEY;
		const creemProductId = env.CREEM_PRODUCT_ID_PROJECT_PASS || env.CREEM_PRODUCT_ID;
		const isTestMode = env.CREEM_TEST_MODE !== 'false';

		if (creemApiKey && creemProductId) {
			const baseUrl = isTestMode
				? 'https://test-api.creem.io/v1/checkouts'
				: 'https://api.creem.io/v1/checkouts';
			try {
				const res = await fetch(baseUrl, {
					method: 'POST',
					headers: {
						'x-api-key': creemApiKey,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						product_id: creemProductId,
						request_id: data.id,
						success_url: `${event.url.origin}/portal/dashboard?upgrade_success=true&project_id=${data.id}`
					})
				});

				if (!res.ok) {
					const errorText = await res.text();
					throw new Error(`Creem API returned ${res.status}: ${errorText}`);
				}

				const checkoutData = (await res.json()) as { checkout_url: string };
				return { redirectUrl: checkoutData.checkout_url };
			} catch (err) {
				console.error('Failed to create Creem checkout:', err);
				error(500, 'Failed to initialize payment gateway.');
			}
		} else {
			// Mock Upgrade mode for local development/testing without keys
			try {
				await db
					.update(projects)
					.set({ tier: 'pro' })
					.where(and(eq(projects.id, data.id), eq(projects.userId, user.id)));

				return { success: true, mockUpgraded: true };
			} catch (err) {
				console.error('Failed to upgrade project (mock):', err);
				error(500, 'Mock upgrade failed');
			}
		}
	}
);

export const createOrganization = form(
	v.object({
		name: v.pipe(v.string(), v.nonEmpty('Organization name is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		const { locals } = event;
		const { session, user, db } = locals;

		if (!session || !user) {
			error(401, 'Unauthorized');
		}

		try {
			const orgId = crypto.randomUUID();
			await db.transaction(async (tx) => {
				await tx.insert(organizations).values({
					id: orgId,
					name: data.name.trim(),
					ownerId: user.id,
					tier: 'free',
					createdAt: new Date()
				});

				await tx.insert(organizationMemberships).values({
					id: crypto.randomUUID(),
					organizationId: orgId,
					userId: user.id,
					role: 'admin',
					createdAt: new Date()
				});
			});

			return { success: true, organizationId: orgId };
		} catch (err) {
			console.error('Failed to create organization:', err);
			error(500, 'Failed to create organization');
		}
	}
);

export const upgradeOrganization = form(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty('Organization ID is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		const { locals } = event;
		const { session, user, db } = locals;

		if (!session || !user) {
			error(401, 'Unauthorized');
		}

		// Verify organization ownership/admin
		const membership = await db
			.select()
			.from(organizationMemberships)
			.where(
				and(
					eq(organizationMemberships.organizationId, data.id),
					eq(organizationMemberships.userId, user.id),
					eq(organizationMemberships.role, 'admin')
				)
			)
			.get();

		if (!membership) {
			error(403, 'Forbidden: Admin access required to upgrade organization');
		}

		// Get current seats count (memberships + pending invites)
		const members = await db
			.select()
			.from(organizationMemberships)
			.where(eq(organizationMemberships.organizationId, data.id))
			.all();

		const invites = await db
			.select()
			.from(organizationInvites)
			.where(eq(organizationInvites.organizationId, data.id))
			.all();

		const totalSeats = members.length + invites.length;

		const creemApiKey = env.CREEM_API_KEY;
		const creemProductId = env.CREEM_PRODUCT_ID_TEAM_PLAN;
		const isTestMode = env.CREEM_TEST_MODE !== 'false';

		if (creemApiKey && creemProductId) {
			const baseUrl = isTestMode
				? 'https://test-api.creem.io/v1/checkouts'
				: 'https://api.creem.io/v1/checkouts';
			try {
				const res = await fetch(baseUrl, {
					method: 'POST',
					headers: {
						'x-api-key': creemApiKey,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						product_id: creemProductId,
						quantity: totalSeats,
						request_id: data.id,
						metadata: {
							organizationId: data.id
						},
						success_url: `${event.url.origin}/portal/dashboard?upgrade_success=true&org_id=${data.id}`
					})
				});

				if (!res.ok) {
					const errorText = await res.text();
					throw new Error(`Creem API returned ${res.status}: ${errorText}`);
				}

				const checkoutData = (await res.json()) as { checkout_url: string };
				return { redirectUrl: checkoutData.checkout_url };
			} catch (err) {
				console.error('Failed to create Creem checkout for organization:', err);
				error(500, 'Failed to initialize payment gateway.');
			}
		} else {
			// Mock upgrade for local testing
			try {
				await db.update(organizations).set({ tier: 'team' }).where(eq(organizations.id, data.id));

				return { success: true, mockUpgraded: true };
			} catch (err) {
				console.error('Failed to upgrade organization (mock):', err);
				error(500, 'Mock upgrade failed');
			}
		}
	}
);

export const inviteMember = form(
	v.object({
		organizationId: v.pipe(v.string(), v.nonEmpty('Organization ID is required')),
		email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email address'))
	}),
	async (data) => {
		const event = getRequestEvent();
		const { locals } = event;
		const { session, user, db } = locals;

		if (!session || !user) {
			error(401, 'Unauthorized');
		}

		// Verify user is an admin of the organization
		const membership = await db
			.select()
			.from(organizationMemberships)
			.where(
				and(
					eq(organizationMemberships.organizationId, data.organizationId),
					eq(organizationMemberships.userId, user.id),
					eq(organizationMemberships.role, 'admin')
				)
			)
			.get();

		if (!membership) {
			error(403, 'Forbidden: Admin access required to invite members');
		}

		// Create invite entry
		const token = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiration

		try {
			await db.insert(organizationInvites).values({
				id: crypto.randomUUID(),
				organizationId: data.organizationId,
				email: data.email.trim().toLowerCase(),
				token,
				expiresAt,
				createdAt: new Date()
			});

			const inviteUrl = `${event.url.origin}/invites/accept?token=${token}`;
			console.log(
				`[Developer Workspace Invite] Created invitation for ${data.email}. Invite URL:\n${inviteUrl}`
			);

			// Sync seats with Creem
			await syncCreemSubscriptionSeats(db, data.organizationId);

			return { success: true, inviteUrl };
		} catch (err) {
			console.error('Failed to create invitation:', err);
			error(500, 'Failed to create invitation');
		}
	}
);

export const cancelInvite = form(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty('Invite ID is required')),
		organizationId: v.pipe(v.string(), v.nonEmpty('Organization ID is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		const { locals } = event;
		const { session, user, db } = locals;

		if (!session || !user) {
			error(401, 'Unauthorized');
		}

		// Verify user is an admin
		const membership = await db
			.select()
			.from(organizationMemberships)
			.where(
				and(
					eq(organizationMemberships.organizationId, data.organizationId),
					eq(organizationMemberships.userId, user.id),
					eq(organizationMemberships.role, 'admin')
				)
			)
			.get();

		if (!membership) {
			error(403, 'Forbidden: Admin access required to cancel invites');
		}

		try {
			await db.delete(organizationInvites).where(eq(organizationInvites.id, data.id));

			// Sync seats with Creem
			await syncCreemSubscriptionSeats(db, data.organizationId);

			return { success: true };
		} catch (err) {
			console.error('Failed to cancel invitation:', err);
			error(500, 'Failed to cancel invitation');
		}
	}
);

export const removeMember = form(
	v.object({
		organizationId: v.pipe(v.string(), v.nonEmpty('Organization ID is required')),
		userId: v.pipe(v.string(), v.nonEmpty('User ID is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		const { locals } = event;
		const { session, user, db } = locals;

		if (!session || !user) {
			error(401, 'Unauthorized');
		}

		// Verify user is an admin
		const adminMembership = await db
			.select()
			.from(organizationMemberships)
			.where(
				and(
					eq(organizationMemberships.organizationId, data.organizationId),
					eq(organizationMemberships.userId, user.id),
					eq(organizationMemberships.role, 'admin')
				)
			)
			.get();

		if (!adminMembership) {
			error(403, 'Forbidden: Admin access required to remove members');
		}

		// Prevent removing the owner of the organization
		const org = await db
			.select()
			.from(organizations)
			.where(eq(organizations.id, data.organizationId))
			.get();
		if (org && org.ownerId === data.userId) {
			error(400, 'Cannot remove the owner of the organization');
		}

		try {
			await db
				.delete(organizationMemberships)
				.where(
					and(
						eq(organizationMemberships.organizationId, data.organizationId),
						eq(organizationMemberships.userId, data.userId)
					)
				);

			// Sync seats with Creem
			await syncCreemSubscriptionSeats(db, data.organizationId);

			return { success: true };
		} catch (err) {
			console.error('Failed to remove member:', err);
			error(500, 'Failed to remove member');
		}
	}
);
