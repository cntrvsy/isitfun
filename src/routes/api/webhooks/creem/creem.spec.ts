/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { projects, processedWebhooks, organizations } from '$lib/server/db/schema';

vi.mock('$env/dynamic/private', () => ({
	env: {
		CREEM_WEBHOOK_SECRET: undefined
	}
}));

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
				eventType: 'checkout.completed',
				object: {
					id: 'ch_1',
					request_id: 'proj_1',
					status: 'completed',
					order: {
						id: 'ord_1',
						customer: 'cust_1',
						amount: 1500,
						currency: 'gbp',
						status: 'paid'
					}
				}
			})
		});

		let selectedTable: any = null;
		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockImplementation((table) => {
				selectedTable = table;
				return mockDb;
			}),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockImplementation(async () => {
				if (selectedTable === processedWebhooks) return null;
				if (selectedTable === organizations) return null;
				if (selectedTable === projects) return { id: 'proj_1', userId: 'user_1' };
				return null;
			}),
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
		expect(mockDb.update).toHaveBeenCalledWith(projects);
		expect(mockDb.set).toHaveBeenCalledWith({ tier: 'pro' });
		expect(mockDb.insert).toHaveBeenCalledTimes(2); // processedWebhooks and payments
	});

	it('upgrades organization tier to team on checkout.completed with metadata', async () => {
		const request = new Request('http://localhost/api/webhooks/creem', {
			method: 'POST',
			body: JSON.stringify({
				id: 'evt_org_1',
				eventType: 'checkout.completed',
				object: {
					id: 'ch_org_1',
					subscription_id: 'sub_org_123',
					status: 'completed',
					metadata: {
						organizationId: 'org_123'
					},
					order: {
						id: 'ord_org_1',
						customer: 'cust_org_1',
						amount: 500,
						currency: 'gbp',
						status: 'paid'
					}
				}
			})
		});

		let selectedTable: any = null;
		const mockDb = {
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockImplementation((table) => {
				selectedTable = table;
				return mockDb;
			}),
			where: vi.fn().mockReturnThis(),
			get: vi.fn().mockImplementation(async () => {
				if (selectedTable === processedWebhooks) return null;
				if (selectedTable === organizations) return { id: 'org_123', ownerId: 'owner_123' };
				return null;
			}),
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
		expect(body).toEqual({ received: true, upgradedOrg: 'org_123' });
		expect(mockDb.update).toHaveBeenCalledWith(organizations);
		expect(mockDb.set).toHaveBeenCalledWith({ tier: 'team', creemSubscriptionId: 'sub_org_123' });
	});

	it('does not upgrade project if status is pending', async () => {
		const request = new Request('http://localhost/api/webhooks/creem', {
			method: 'POST',
			body: JSON.stringify({
				id: 'evt_2',
				eventType: 'checkout.created',
				object: {
					id: 'ch_2',
					request_id: 'proj_1',
					status: 'created',
					order: {
						id: 'ord_2',
						customer: 'cust_1',
						amount: 1500,
						currency: 'gbp',
						status: 'pending'
					}
				}
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
