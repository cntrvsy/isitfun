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
		const isDev = c.env.ENVIRONMENT === 'development';
		if (!isDev) {
			return c.json({ error: 'Webhook secret unconfigured' }, 401);
		}
		console.warn(
			'[Creem Webhook] CREEM_WEBHOOK_SECRET missing, bypassed for testing in development'
		);
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
			const subscriptionId = (objectData.subscription_id || objectData.id || null) as string | null;
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

				// Insert payment transaction record into payments table
				try {
					await db.insert(schema.payments).values({
						id: crypto.randomUUID(),
						projectId,
						userId: project.userId,
						creemCheckoutId: String(objectData.checkout_id || objectData.id || crypto.randomUUID()),
						creemOrderId: String(orderData.id || objectData.order_id || objectData.id || ''),
						creemCustomerId: String(objectData.customer_id || orderData.customer_id || ''),
						amount: Number(orderData.amount || objectData.amount || 1900),
						currency: String(orderData.currency || objectData.currency || 'usd').toLowerCase(),
						status: 'completed',
						createdAt: new Date()
					});
				} catch (payErr) {
					console.error('[Billing Webhook] Failed to record payment in DB:', payErr);
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

async function verifySvixSignature(
	payload: string,
	svixId: string,
	svixTimestamp: string,
	svixSignature: string,
	secret: string
): Promise<boolean> {
	const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
	const secretBytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0));
	const signedContent = new TextEncoder().encode(`${svixId}.${svixTimestamp}.${payload}`);

	const key = await crypto.subtle.importKey(
		'raw',
		secretBytes,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sigBuffer = await crypto.subtle.sign('HMAC', key, signedContent);
	const expectedSig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

	return svixSignature
		.split(' ')
		.some((part) => part.startsWith('v1,') && part.slice(3) === expectedSig);
}

// POST /v1/webhooks/resend - Resend email webhook
webhooksRouter.post('/resend', async (c) => {
	const webhookSecret = c.env.RESEND_WEBHOOK_SECRET;
	const payload = await c.req.text();
	const svixId = c.req.header('svix-id');
	const svixTimestamp = c.req.header('svix-timestamp');
	const svixSignature = c.req.header('svix-signature');

	if (webhookSecret) {
		if (!svixId || !svixTimestamp || !svixSignature) {
			return c.json({ error: 'Missing Svix signature headers' }, 400);
		}
		try {
			const isValid = await verifySvixSignature(
				payload,
				svixId,
				svixTimestamp,
				svixSignature,
				webhookSecret
			);
			if (!isValid) {
				return c.json({ error: 'Invalid webhook signature' }, 401);
			}
		} catch (err) {
			console.error('[Resend Webhook] Signature verification failed:', err);
			return c.json({ error: 'Invalid webhook signature' }, 401);
		}
	} else {
		const isDev = c.env.ENVIRONMENT === 'development' || c.env.ENVIRONMENT === 'test' || !c.env.ENVIRONMENT;
		if (!isDev) {
			console.error('[Resend Webhook] RESEND_WEBHOOK_SECRET is not configured in production.');
			return c.json(
				{ error: 'Server configuration error: Webhook secret is not configured' },
				500
			);
		}
	}

	try {
		const event = JSON.parse(payload) as {
			type: string;
			created_at: string;
			data?: {
				email_id?: string;
				to?: string[];
				reason?: string;
			};
		};

		const eventType = event.type;
		const eventData = event.data || {};

		switch (eventType) {
			case 'email.sent':
				console.log(`[Resend Webhook] Email sent to ${eventData.to?.join(', ')}`);
				break;
			case 'email.delivered':
				console.log(`[Resend Webhook] Email delivered to ${eventData.to?.join(', ')}`);
				break;
			case 'email.bounced':
				console.warn(
					`[Resend Webhook WARNING] Email bounced for ${eventData.to?.join(', ')}. Reason: ${
						eventData.reason || 'Unknown'
					}`
				);
				break;
			case 'email.complained':
				console.warn(`[Resend Webhook ALERT] Spam complaint from ${eventData.to?.join(', ')}`);
				break;
			case 'email.failed':
				console.error(`[Resend Webhook ERROR] Delivery failed for ${eventData.to?.join(', ')}`);
				break;
			default:
				console.log(`[Resend Webhook] Received event: ${eventType}`);
		}

		return c.json({ received: true, type: eventType });
	} catch (err) {
		console.error('[Resend Webhook] Failed to parse event JSON:', err);
		return c.json({ error: 'Invalid JSON payload' }, 400);
	}
});
