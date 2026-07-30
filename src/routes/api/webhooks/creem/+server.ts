import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { projects, processedWebhooks, payments, organizations } from '$lib/server/db/db-schema';
import { env } from '$env/dynamic/private';
import { verifyWebhookSignature } from '$lib/server/crypto';

export const POST: RequestHandler = async ({ request, locals }) => {
	const bodyText = await request.text();

	// Signature verification
	const signature = request.headers.get('creem-signature');
	const webhookSecret = env.CREEM_WEBHOOK_SECRET;

	if (webhookSecret) {
		if (!signature) {
			throw error(400, 'Missing creem-signature header');
		}
		const isValid = await verifyWebhookSignature(bodyText, signature, webhookSecret);
		if (!isValid) {
			throw error(400, 'Invalid webhook signature');
		}
	} else {
		console.warn(
			'[Creem Webhook] CREEM_WEBHOOK_SECRET is not configured. Webhook signature verification bypassed (dev/mock mode).'
		);
	}

	let body: {
		id?: string;
		eventType?: string;
		created_at?: number;
		object?: {
			id?: string;
			object?: string;
			request_id?: string;
			status?: string;
			subscription_id?: string;
			metadata?: Record<string, unknown>;
			order?: {
				id?: string;
				customer?: string;
				product?: string;
				amount?: number;
				currency?: string;
				status?: string;
				metadata?: Record<string, unknown>;
			};
		};
	};
	try {
		body = JSON.parse(bodyText);
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const eventType = body.eventType || 'checkout.completed';
	const objectData = (body as any).object || (body as any).data || {};
	const orderData = objectData.order || {};

	const metadata = {
		...(objectData.metadata || {}),
		...(orderData.metadata || {})
	};
	const projectId = (metadata.projectId || metadata.project_id || objectData.request_id) as
		| string
		| null
		| undefined;
	const status = orderData.status || objectData.status;
	const webhookId = body.id || objectData.id;

	const organizationId = (metadata.organizationId || metadata.organization_id || null) as
		| string
		| null;
	const activeOrgId = (organizationId || projectId) as string | null | undefined;

	// 1. Idempotency Check: prevent duplicate webhook processing
	if (webhookId) {
		try {
			const existing = await locals.db
				.select()
				.from(processedWebhooks)
				.where(eq(processedWebhooks.id, webhookId))
				.get();
			if (existing) {
				return json({ received: true, message: 'Webhook already processed' });
			}
		} catch (err) {
			console.warn('[Creem Webhook] Idempotency check skipped due to DB error:', err);
		}
	}

	if (
		(activeOrgId || projectId) &&
		(status === 'completed' || status === 'paid' || eventType === 'checkout.completed')
	) {
		try {
			// 1. Check if the activeOrgId is actually an organizationId
			const org = activeOrgId
				? await locals.db
						.select()
						.from(organizations)
						.where(eq(organizations.id, activeOrgId))
						.get()
				: null;

			if (org) {
				await locals.db.transaction(async (tx) => {
					// Mark Webhook as processed
					if (webhookId) {
						await tx.insert(processedWebhooks).values({
							id: webhookId,
							processedAt: new Date()
						});
					}

					// Upgrade organization to team plan and save subscription ID
					const subscriptionId = objectData.subscription_id || objectData.id || null;
					await tx
						.update(organizations)
						.set({ tier: 'team', creemSubscriptionId: subscriptionId })
						.where(eq(organizations.id, org.id));

					// Record payment ledger entry
					const amount = typeof orderData.amount === 'number' ? orderData.amount : 500;
					const currency = orderData.currency || 'gbp';
					const checkoutId = objectData.id || body.id || null;
					const orderId = orderData.id || null;
					const customerId = orderData.customer || null;

					await tx.insert(payments).values({
						id: crypto.randomUUID(),
						projectId: null,
						userId: org.ownerId,
						creemCheckoutId: checkoutId,
						creemOrderId: orderId,
						creemCustomerId: customerId,
						amount,
						currency,
						status: 'completed',
						createdAt: new Date()
					});
				});

				console.log(`[Creem Webhook] Upgraded organization ${org.id} to Team tier successfully.`);
				return json({ received: true, upgradedOrg: org.id });
			}

			if (!projectId) {
				console.error(
					`[Creem Webhook] Target organization or project not found: activeOrgId=${activeOrgId}`
				);
				throw error(404, 'Target not found');
			}

			// 2. Fallback: Retrieve the project to find the owner's userId
			const project = await locals.db
				.select()
				.from(projects)
				.where(eq(projects.id, projectId))
				.get();

			if (!project) {
				console.error(`[Creem Webhook] Target organization or project not found: ${projectId}`);
				throw error(404, 'Target not found');
			}

			// Atomic database operations for project upgrade
			await locals.db.transaction(async (tx) => {
				// Mark the webhook as processed
				if (webhookId) {
					await tx.insert(processedWebhooks).values({
						id: webhookId,
						processedAt: new Date()
					});
				}

				// Upgrade the project to Pro tier
				await tx.update(projects).set({ tier: 'pro' }).where(eq(projects.id, projectId));

				// Record payment ledger entry
				const amount = typeof orderData.amount === 'number' ? orderData.amount : 1500;
				const currency = orderData.currency || 'gbp';
				const checkoutId = objectData.id || body.id || null;
				const orderId = orderData.id || null;
				const customerId = orderData.customer || null;

				await tx.insert(payments).values({
					id: crypto.randomUUID(),
					projectId,
					userId: project.userId,
					creemCheckoutId: checkoutId,
					creemOrderId: orderId,
					creemCustomerId: customerId,
					amount,
					currency,
					status: 'completed',
					createdAt: new Date()
				});
			});

			console.log(`[Creem Webhook] Upgraded project ${projectId} to Pro tier successfully.`);
			return json({ received: true, upgraded: projectId });
		} catch (err) {
			console.error('[Creem Webhook] Failed to process webhook transaction in DB:', err);
			throw error(500, 'Database transaction failed');
		}
	}

	return json({ received: true, message: 'No action taken' });
};
