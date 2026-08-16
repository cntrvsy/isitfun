/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {}
}));

import { POST } from '../../src/routes/api/webhooks/creem/+server';

describe('POST /api/webhooks/creem', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('upgrades project tier to pro on checkout.completed', async () => {
		const payload = {
			event: 'checkout.completed',
			data: {
				id: 'chk_123',
				order: 'ord_123',
				customer: 'cust_123',
				amount: 2900,
				currency: 'gbp',
				metadata: {
					projectId: 'proj_1',
					userId: 'user_1'
				}
			}
		};

		const request = new Request('http://localhost/api/webhooks/creem', {
			method: 'POST',
			headers: { 'creem-signature': 'mock_sig' },
			body: JSON.stringify(payload)
		});

		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi
				.fn()
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({ id: 'proj_1', userId: 'user_1' }),
			insert: vi.fn().mockReturnThis(),
			values: vi.fn().mockResolvedValue({}),
			update: vi.fn().mockReturnThis(),
			set: vi.fn().mockReturnThis(),
			transaction: vi.fn().mockImplementation(async (cb) => cb(mockDb))
		};

		const res = await POST({
			request,
			locals: { db: mockDb } as any,
			platform: { env: {} } as any
		} as any);

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual(expect.objectContaining({ received: true }));
		expect(mockDb.update).toHaveBeenCalled();
	});

	it('upgrades organization tier to team on checkout.completed with metadata', async () => {
		const payload = {
			event: 'checkout.completed',
			data: {
				id: 'chk_456',
				order: 'ord_456',
				customer: 'cust_456',
				amount: 9900,
				currency: 'gbp',
				subscription_id: 'sub_123',
				metadata: {
					organizationId: 'org_123',
					userId: 'user_1'
				}
			}
		};

		const request = new Request('http://localhost/api/webhooks/creem', {
			method: 'POST',
			headers: { 'creem-signature': 'mock_sig' },
			body: JSON.stringify(payload)
		});

		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi
				.fn()
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({ id: 'org_123', ownerId: 'user_1' }),
			insert: vi.fn().mockReturnThis(),
			values: vi.fn().mockResolvedValue({}),
			update: vi.fn().mockReturnThis(),
			set: vi.fn().mockReturnThis(),
			transaction: vi.fn().mockImplementation(async (cb) => cb(mockDb))
		};

		const res = await POST({
			request,
			locals: { db: mockDb } as any,
			platform: { env: {} } as any
		} as any);

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual(expect.objectContaining({ received: true }));
		expect(mockDb.update).toHaveBeenCalled();
	});

	it('does not upgrade project if status is pending', async () => {
		const payload = {
			eventType: 'checkout.pending',
			event: 'checkout.pending',
			data: {
				id: 'chk_789',
				metadata: { projectId: 'proj_1', userId: 'user_1' }
			}
		};

		const request = new Request('http://localhost/api/webhooks/creem', {
			method: 'POST',
			headers: { 'creem-signature': 'mock_sig' },
			body: JSON.stringify(payload)
		});

		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockResolvedValue(null),
			update: vi.fn()
		};

		const res = await POST({
			request,
			locals: { db: mockDb } as any,
			platform: { env: {} } as any
		} as any);

		expect(res.status).toBe(200);
		expect(mockDb.update).not.toHaveBeenCalled();
	});

	it('downgrades organization tier to free on subscription.canceled', async () => {
		const payload = {
			eventType: 'subscription.canceled',
			data: {
				id: 'sub_123',
				subscription_id: 'sub_123',
				metadata: { organizationId: 'org_123' }
			}
		};

		const request = new Request('http://localhost/api/webhooks/creem', {
			method: 'POST',
			headers: { 'creem-signature': 'mock_sig' },
			body: JSON.stringify(payload)
		});

		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi
				.fn()
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({ id: 'org_123', tier: 'team', creemSubscriptionId: 'sub_123' }),
			insert: vi.fn().mockReturnThis(),
			values: vi.fn().mockResolvedValue({}),
			update: vi.fn().mockReturnThis(),
			set: vi.fn().mockReturnThis(),
			transaction: vi.fn().mockImplementation(async (cb) => cb(mockDb))
		};

		const res = await POST({
			request,
			locals: { db: mockDb } as any,
			platform: { env: {} } as any
		} as any);

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual(expect.objectContaining({ received: true, downgradedOrg: 'org_123' }));
		expect(mockDb.update).toHaveBeenCalled();
	});

	it('downgrades project tier to free on subscription.canceled', async () => {
		const payload = {
			eventType: 'subscription.canceled',
			data: {
				id: 'sub_456',
				metadata: { projectId: 'proj_1' }
			}
		};

		const request = new Request('http://localhost/api/webhooks/creem', {
			method: 'POST',
			headers: { 'creem-signature': 'mock_sig' },
			body: JSON.stringify(payload)
		});

		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			get: vi
				.fn()
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({ id: 'proj_1', tier: 'pro' }),
			insert: vi.fn().mockReturnThis(),
			values: vi.fn().mockResolvedValue({}),
			update: vi.fn().mockReturnThis(),
			set: vi.fn().mockReturnThis(),
			transaction: vi.fn().mockImplementation(async (cb) => cb(mockDb))
		};

		const res = await POST({
			request,
			locals: { db: mockDb } as any,
			platform: { env: {} } as any
		} as any);

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual(expect.objectContaining({ received: true, downgradedProject: 'proj_1' }));
		expect(mockDb.update).toHaveBeenCalled();
	});
});
