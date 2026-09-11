import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { vValidator } from '@hono/valibot-validator';
import * as v from 'valibot';
import { createD1Client, schema } from '@isitfun/db';
import type { AppEnv } from '../types';
import { sessionMiddleware, requireAuth } from '../middleware/auth';

// Helper to sync seats with Creem subscription
export async function syncCreemSubscriptionSeats(
	db: ReturnType<typeof createD1Client>,
	env: AppEnv['Bindings'],
	orgId: string
) {
	const org = await db
		.select()
		.from(schema.organizations)
		.where(eq(schema.organizations.id, orgId))
		.get();

	if (!org || !org.creemSubscriptionId) return;

	const memberships = await db
		.select()
		.from(schema.organizationMemberships)
		.where(eq(schema.organizationMemberships.organizationId, orgId))
		.all();

	const invites = await db
		.select()
		.from(schema.organizationInvites)
		.where(eq(schema.organizationInvites.organizationId, orgId))
		.all();

	const totalSeats = memberships.length + invites.length;
	const creemApiKey = env.CREEM_API_KEY;
	const isTestMode = env.CREEM_TEST_MODE !== 'false';
	const baseUrl = isTestMode ? 'https://test-api.creem.io/v1' : 'https://api.creem.io/v1';

	if (creemApiKey) {
		try {
			const res = await fetch(`${baseUrl}/subscriptions/${org.creemSubscriptionId}`, {
				headers: { 'x-api-key': creemApiKey },
				signal: AbortSignal.timeout(2500)
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
						}),
						signal: AbortSignal.timeout(2500)
					});
				}
			}
		} catch (err) {
			console.error('[Billing] Non-blocking seat sync warning:', err);
		}
	}
}

export const billingRouter = new Hono<AppEnv>()
	.use('*', sessionMiddleware, requireAuth)
	// POST /v1/billing/checkout/project/:id - Initialize Creem checkout session for Project Pro Pass
	.post(
		'/checkout/project/:id',
		vValidator('json', v.object({ successUrl: v.optional(v.string()) })),
		async (c) => {
			const user = c.get('user')!;
			const projectId = c.req.param('id');
			const db = createD1Client(c.env.DB);

			const project = await db
				.select()
				.from(schema.projects)
				.where(eq(schema.projects.id, projectId))
				.get();

			if (!project) return c.json({ error: 'Project not found' }, 404);

			let hasAccess = user.role === 'admin' || project.userId === user.id;
			if (!hasAccess && project.organizationId) {
				const membership = await db
					.select()
					.from(schema.organizationMemberships)
					.where(
						and(
							eq(schema.organizationMemberships.organizationId, project.organizationId),
							eq(schema.organizationMemberships.userId, user.id),
							eq(schema.organizationMemberships.role, 'admin')
						)
					)
					.get();
				if (membership) hasAccess = true;
			}

			if (!hasAccess) {
				return c.json({ error: 'Forbidden: Insufficient permissions to upgrade project' }, 403);
			}

			const body = c.req.valid('json');
		const originHeader = c.req.header('origin') || 'https://isitfun.frstudios.co.ke';
		const successUrl =
			body.successUrl ||
			`${originHeader}/portal/dashboard?upgrade_success=true&project_id=${projectId}`;

		const creemApiKey = c.env.CREEM_API_KEY;
		const creemProductId = c.env.CREEM_PRODUCT_ID_PROJECT_PASS || c.env.CREEM_PRODUCT_ID;
		const isTestMode = c.env.CREEM_TEST_MODE !== 'false';

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
						request_id: projectId,
						success_url: successUrl
					})
				});

				if (!res.ok) {
					const errorText = await res.text();
					throw new Error(`Creem API returned ${res.status}: ${errorText}`);
				}

				const checkoutData = (await res.json()) as { checkout_url: string };
				return c.json({ redirectUrl: checkoutData.checkout_url });
			} catch (err) {
				console.error('[Billing] Failed to create Creem checkout:', err);
				return c.json({ error: 'Failed to initialize payment gateway' }, 500);
			}
		} else {
			// Mock upgrade in development
			await db
				.update(schema.projects)
				.set({ tier: 'pro' })
				.where(eq(schema.projects.id, projectId));

			return c.json({ success: true, mockUpgraded: true });
		}
	})
	// POST /v1/billing/checkout/org/:id - Initialize Creem checkout session for Team Plan
	.post(
		'/checkout/org/:id',
		vValidator('json', v.object({ successUrl: v.optional(v.string()) })),
		async (c) => {
			const user = c.get('user')!;
			const orgId = c.req.param('id');
			const db = createD1Client(c.env.DB);

			const org = await db
				.select()
				.from(schema.organizations)
				.where(eq(schema.organizations.id, orgId))
				.get();

			if (!org) return c.json({ error: 'Organization not found' }, 404);

			const membership = await db
				.select()
				.from(schema.organizationMemberships)
				.where(
					and(
						eq(schema.organizationMemberships.organizationId, orgId),
						eq(schema.organizationMemberships.userId, user.id)
					)
				)
				.get();

			if (
				(!membership || (membership.role !== 'owner' && membership.role !== 'admin')) &&
				user.role !== 'admin'
			) {
				return c.json({ error: 'Forbidden: Organization admin access required' }, 403);
			}

			const body = c.req.valid('json');
		const originHeader = c.req.header('origin') || 'https://isitfun.frstudios.co.ke';
		const successUrl =
			body.successUrl ||
			`${originHeader}/portal/dashboard?upgrade_success=true&org_id=${orgId}`;

		const creemApiKey = c.env.CREEM_API_KEY;
		const creemProductId = c.env.CREEM_PRODUCT_ID_TEAM_SEAT;
		const isTestMode = c.env.CREEM_TEST_MODE !== 'false';

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
						request_id: orgId,
						success_url: successUrl
					})
				});

				if (!res.ok) {
					const errorText = await res.text();
					throw new Error(`Creem API returned ${res.status}: ${errorText}`);
				}

				const checkoutData = (await res.json()) as { checkout_url: string };
				return c.json({ redirectUrl: checkoutData.checkout_url });
			} catch (err) {
				console.error('[Billing] Failed to create Creem team checkout:', err);
				return c.json({ error: 'Failed to initialize payment gateway' }, 500);
			}
		} else {
			// Mock upgrade in development
			await db
				.update(schema.organizations)
				.set({ tier: 'team' })
				.where(eq(schema.organizations.id, orgId));

			return c.json({ success: true, mockUpgraded: true });
		}
	})
	// POST /v1/billing/sync-seats/:orgId - Sync Creem subscription seats
	.post('/sync-seats/:orgId', async (c) => {
		const orgId = c.req.param('orgId');
		const db = createD1Client(c.env.DB);
		await syncCreemSubscriptionSeats(db, c.env, orgId);
		return c.json({ success: true });
	});
