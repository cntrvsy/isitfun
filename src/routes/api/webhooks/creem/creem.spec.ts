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
				id: 'evt_1',
				event: 'checkout.completed',
				request_id: 'proj_1',
				status: 'paid'
			})
		});

		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi
				.fn()
				.mockResolvedValueOnce(null) // idempotency check
				.mockResolvedValueOnce({ id: 'proj_1', userId: 'user_1' }), // project lookup
			insert: vi.fn().mockReturnThis(),
			values: vi.fn().mockResolvedValue({}),
			update: vi.fn().mockReturnThis(),
			set: vi.fn().mockReturnThis(),
			transaction: vi.fn().mockImplementation(async (callback) => {
				return callback(mockDb);
			})
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
		expect(mockDb.insert).toHaveBeenCalledTimes(2); // processedWebhooks and payments
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
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue(null),
			update: vi.fn(),
			set: vi.fn(),
			where_update: vi.fn()
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
