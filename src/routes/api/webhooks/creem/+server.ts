import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { projects } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request, locals }) => {
	const bodyText = await request.text();
	let body: {
		event?: string;
		status?: string;
		request_id?: string;
		data?: {
			request_id?: string;
			status?: string;
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

	if (projectId && (status === 'completed' || status === 'paid' || eventType === 'checkout.completed')) {
		try {
			await locals.db
				.update(projects)
				.set({ tier: 'pro' })
				.where(eq(projects.id, projectId));
			
			console.log(`[Creem Webhook] Upgraded project ${projectId} to Pro tier successfully.`);
			return json({ received: true, upgraded: projectId });
		} catch (err) {
			console.error('[Creem Webhook] Failed to upgrade project in DB:', err);
			throw error(500, 'Database update failed');
		}
	}

	return json({ received: true, message: 'No action taken' });
};
