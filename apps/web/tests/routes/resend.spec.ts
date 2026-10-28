import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '@isitfun/api';

describe('POST /v1/webhooks/resend', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('handles email.delivered event successfully in mock mode', async () => {
		const payload = {
			type: 'email.delivered',
			created_at: new Date().toISOString(),
			data: {
				email_id: 'msg_123',
				to: ['developer@example.com']
			}
		};

		const res = await app.request(
			'/v1/webhooks/resend',
			{
				method: 'POST',
				body: JSON.stringify(payload)
			},
			{ ENVIRONMENT: 'test' } as any
		);
		expect(res.status).toBe(200);
		const json = (await res.json()) as { received: boolean; type: string };
		expect(json.received).toBe(true);
		expect(json.type).toBe('email.delivered');
	});

	it('handles email.bounced warning event successfully', async () => {
		const payload = {
			type: 'email.bounced',
			created_at: new Date().toISOString(),
			data: {
				email_id: 'msg_456',
				to: ['bounced@example.com'],
				reason: 'Mailbox full'
			}
		};

		const res = await app.request(
			'/v1/webhooks/resend',
			{
				method: 'POST',
				body: JSON.stringify(payload)
			},
			{ ENVIRONMENT: 'test' } as any
		);
		expect(res.status).toBe(200);
		const json = (await res.json()) as { received: boolean; type: string };
		expect(json.received).toBe(true);
		expect(json.type).toBe('email.bounced');
	});

	it('returns 400 when body payload is invalid JSON', async () => {
		const res = await app.request(
			'/v1/webhooks/resend',
			{
				method: 'POST',
				body: 'invalid-json-body'
			},
			{ ENVIRONMENT: 'test' } as any
		);
		expect(res.status).toBe(400);
		const json = (await res.json()) as { error: string };
		expect(json.error).toBe('Invalid JSON payload');
	});
});
