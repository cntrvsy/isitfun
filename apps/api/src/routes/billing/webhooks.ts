import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createD1Client, schema } from '@isitfun/db';
import type { AppEnv } from '../../types';
import { verifyWebhookSignature } from '../../lib/crypto';

export const webhooksRouter = new Hono<AppEnv>();

// POST /v1/webhooks/creem - Creem billing webhook
webhooksRouter.post('/creem', async (c) => {
	const bodyText = await c.req.text();
	const signature = c.req.header('creem-signature');
	const secret = c.env.CREEM_WEBHOOK_SECRET;

	if (secret) {
		if (!signature) {
			return c.json({ error: 'Missing creem-signature header' }, 400);
		}
		const isValid = await verifyWebhookSignature(bodyText, signature, secret);
		if (!isValid) {
			return c.json({ error: 'Invalid webhook signature' }, 400);
		}
	} else {
		console.warn('[Creem Webhook] CREEM_WEBHOOK_SECRET missing, bypassed for testing');
	}

	let body: Record<string, unknown>;
	try {
		body = JSON.parse(bodyText);
	} catch {
		return c.json({ error: 'Invalid JSON body' }, 400);
	}

	const eventType = String(body.eventType || 'checkout.completed');
	const objectData = (body.object || body.data || {}) as Record<string, unknown>;
	const orderData = (objectData.order || {}) as Record<string, unknown>;
	const metadata = {
		...((objectData.metadata || {}) as Record<string, unknown>),
		...((orderData.metadata || {}) as Record<string, unknown>)
	};

	const webhookId = (body.id || objectData.id || null) as string | null;
	const projectId = (metadata.projectId || metadata.project_id || objectData.request_id || null) as
		| string
		| null;
	const organizationId = (metadata.organizationId || metadata.organization_id || null) as
		| string
		| null;
	const status = String(orderData.status || objectData.status || '');

	const db = createD1Client(c.env.DB);

	// 1. Idempotency Check
	if (webhookId) {
		try {
			const existing = await db
				.select()
				.from(schema.processedWebhooks)
				.where(eq(schema.processedWebhooks.id, webhookId))
				.get();

			if (existing) {
				return c.json({ received: true, message: 'Webhook already processed' });
			}
		} catch (err) {
			console.warn('[Creem Webhook] Idempotency check error:', err);
		}
	}

	const isDowngrade =
		eventType === 'subscription.canceled' ||
		eventType === 'subscription.expired' ||
		status === 'canceled' ||
		status === 'expired';

	if (isDowngrade) {
		const subId = (objectData.subscription_id || objectData.id || null) as string | null;
		let org = organizationId
			? await db
					.select()
					.from(schema.organizations)
					.where(eq(schema.organizations.id, organizationId))
					.get()
			: null;

		if (!org && subId) {
			org = await db
				.select()
				.from(schema.organizations)
				.where(eq(schema.organizations.creemSubscriptionId, subId))
				.get();
		}

		if (org) {
			if (webhookId) {
				await db.insert(schema.processedWebhooks).values({
					id: webhookId,
					eventType,
					processedAt: new Date()
				});
			}
			await db
				.update(schema.organizations)
				.set({ tier: 'free', creemSubscriptionId: null })
				.where(eq(schema.organizations.id, org.id));

			return c.json({ received: true, downgradedOrg: org.id });
		}

		if (projectId) {
			if (webhookId) {
				await db.insert(schema.processedWebhooks).values({
					id: webhookId,
					eventType,
					processedAt: new Date()
				});
			}
			await db
				.update(schema.projects)
				.set({ tier: 'free' })
				.where(eq(schema.projects.id, projectId));

			return c.json({ received: true, downgradedProject: projectId });
		}
	}

	if (
		(organizationId || projectId) &&
		(status === 'completed' || status === 'paid' || eventType === 'checkout.completed')
	) {
		const org = organizationId
			? await db
					.select()
					.from(schema.organizations)
					.where(eq(schema.organizations.id, organizationId))
					.get()
			: null;

		if (org) {
			if (webhookId) {
				await db.insert(schema.processedWebhooks).values({
					id: webhookId,
					eventType,
					processedAt: new Date()
				});
			}
			const subscriptionId = (objectData.subscription_id || objectData.id || null) as
				| string
				| null;
			await db
				.update(schema.organizations)
				.set({ tier: 'team', creemSubscriptionId: subscriptionId })
				.where(eq(schema.organizations.id, org.id));

			return c.json({ received: true, upgradedOrg: org.id });
		}

		if (projectId) {
			const project = await db
				.select()
				.from(schema.projects)
				.where(eq(schema.projects.id, projectId))
				.get();

			if (project) {
				if (webhookId) {
					await db.insert(schema.processedWebhooks).values({
						id: webhookId,
						eventType,
						processedAt: new Date()
					});
				}
				await db
					.update(schema.projects)
					.set({ tier: 'pro' })
					.where(eq(schema.projects.id, projectId));

				return c.json({ received: true, upgradedProject: projectId });
			}
		}
	}

	return c.json({ received: true, ignored: true });
});

// POST /v1/webhooks/resend - Resend email webhook
webhooksRouter.post('/resend', async (c) => {
	const body = await c.req.json();
	console.log('[Resend Webhook Event]:', body);
	return c.json({ received: true });
});
