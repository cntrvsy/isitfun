import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { projects, processedWebhooks, payments } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request, locals }) => {
	const bodyText = await request.text();
	let body: {
		id?: string;
		event?: string;
		status?: string;
		request_id?: string;
		data?: {
			id?: string;
			event?: string;
			status?: string;
			request_id?: string;
			order_id?: string;
			customer_id?: string;
			amount?: number;
			currency?: string;
		};
	};
	try {
		body = JSON.parse(bodyText);
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const eventType = body.event || 'checkout.completed';
	const data = body.data || body;
	const projectId = data.request_id;
	const status = data.status;
	const webhookId = body.id || data.id;

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
		projectId &&
		(status === 'completed' || status === 'paid' || eventType === 'checkout.completed')
	) {
		try {
			// Retrieve the project to find the owner's userId
			const project = await locals.db
				.select()
				.from(projects)
				.where(eq(projects.id, projectId))
				.get();

			if (!project) {
				console.error(`[Creem Webhook] Project not found: ${projectId}`);
				throw error(404, 'Project not found');
			}

			// Atomic database operations
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
				const amount = typeof data.amount === 'number' ? data.amount : 1500;
				const currency = data.currency || 'gbp';
				const checkoutId = data.id || body.id || null;
				const orderId = data.order_id || null;
				const customerId = data.customer_id || null;

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
