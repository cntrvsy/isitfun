/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server';

describe('POST /api/webhooks/creem', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('upgrades project tier to pro on checkout.completed', async () => {
		const request = new Request('http://localhost/api/webhooks/creem', {
			method: 'POST',
			body: JSON.stringify({
				event: 'checkout.completed',
				request_id: 'proj_1',
				status: 'paid'
			})
		});

		const mockDb = {
			update: vi.fn().mockReturnThis(),
			set: vi.fn().mockReturnThis(),
			where: vi.fn().mockResolvedValue({})
		};

		const res = await POST({
			request,
			locals: { db: mockDb } as any
		} as any);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ received: true, upgraded: 'proj_1' });
		expect(mockDb.update).toHaveBeenCalled();
		expect(mockDb.set).toHaveBeenCalledWith({ tier: 'pro' });
	});

	it('does not upgrade project if status is pending', async () => {
		const request = new Request('http://localhost/api/webhooks/creem', {
			method: 'POST',
			body: JSON.stringify({
				event: 'checkout.created',
				request_id: 'proj_1',
				status: 'pending'
			})
		});

		const mockDb = {
			update: vi.fn(),
			set: vi.fn(),
			where: vi.fn()
		};

		const res = await POST({
			request,
			locals: { db: mockDb } as any
		} as any);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ received: true, message: 'No action taken' });
		expect(mockDb.update).not.toHaveBeenCalled();
	});
});
