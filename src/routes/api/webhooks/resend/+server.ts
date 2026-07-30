import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { Webhook } from 'svix';

export const POST: RequestHandler = async ({ request }) => {
	const webhookSecret = env.RESEND_WEBHOOK_SECRET;

	const payload = await request.text();
	const svixId = request.headers.get('svix-id');
	const svixTimestamp = request.headers.get('svix-timestamp');
	const svixSignature = request.headers.get('svix-signature');

	// If webhook secret is configured, verify Svix signature
	if (webhookSecret) {
		if (!svixId || !svixTimestamp || !svixSignature) {
			return json({ error: 'Missing Svix signature headers' }, { status: 400 });
		}

		try {
			const wh = new Webhook(webhookSecret);
			wh.verify(payload, {
				'svix-id': svixId,
				'svix-timestamp': svixTimestamp,
				'svix-signature': svixSignature
			});
		} catch (err) {
			console.error('[Resend Webhook] Signature verification failed:', err);
			return json({ error: 'Invalid webhook signature' }, { status: 401 });
		}
	}

	try {
		const event = JSON.parse(payload) as {
			type: string;
			created_at: string;
			data: {
				created_at?: string;
				email_id?: string;
				from?: string;
				to?: string[];
				subject?: string;
				reason?: string;
				bounce?: Record<string, unknown>;
			};
		};

		const eventType = event.type;
		const eventData = event.data;

		console.log(`[Resend Webhook Event] ${eventType} - Email ID: ${eventData.email_id || 'N/A'}`);

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

		return json({ received: true, type: eventType });
	} catch (err) {
		console.error('[Resend Webhook] Failed to parse event JSON:', err);
		return json({ error: 'Invalid JSON payload' }, { status: 400 });
	}
};
