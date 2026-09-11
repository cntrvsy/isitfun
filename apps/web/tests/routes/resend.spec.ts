/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {}
}));

import { POST } from '../../src/routes/api/webhooks/resend/+server';

describe('POST /api/webhooks/resend', () => {
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

		const request = new Request('http://localhost/api/webhooks/resend', {
			method: 'POST',
			body: JSON.stringify(payload)
		});

		const res = await POST({ request } as any);
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

		const request = new Request('http://localhost/api/webhooks/resend', {
			method: 'POST',
			body: JSON.stringify(payload)
		});

		const res = await POST({ request } as any);
		expect(res.status).toBe(200);
		const json = (await res.json()) as { received: boolean; type: string };
		expect(json.received).toBe(true);
		expect(json.type).toBe('email.bounced');
	});

	it('returns 400 when body payload is invalid JSON', async () => {
		const request = new Request('http://localhost/api/webhooks/resend', {
			method: 'POST',
			body: 'invalid-json-body'
		});

		const res = await POST({ request } as any);
		expect(res.status).toBe(400);
		const json = (await res.json()) as { error: string };
		expect(json.error).toBe('Invalid JSON payload');
	});
});
