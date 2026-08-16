import { describe, it, expect } from 'vitest';
import { validateAccessKey, getMaxUsesCapForTier } from '#lib/server/db/access-keys.js';

describe('Access Keys & Protection Logic', () => {
	it('returns correct max uses cap for each tier', () => {
		expect(getMaxUsesCapForTier('free')).toBe(20);
		expect(getMaxUsesCapForTier('pro')).toBe(100);
		expect(getMaxUsesCapForTier('team')).toBe(1000);
		expect(getMaxUsesCapForTier('unknown')).toBe(20);
	});

	it('validates active key within capacity', () => {
		const mockKey = {
			id: 'key_1',
			projectId: 'proj_1',
			name: 'Test Key',
			code: 'TEST-123',
			maxUses: 20,
			usedCount: 5,
			expiresAt: null,
			isActive: true,
			createdAt: new Date()
		};

		const result = validateAccessKey(mockKey as unknown as Parameters<typeof validateAccessKey>[0]);
		expect(result.valid).toBe(true);
		expect(result.key).toEqual(mockKey);
	});

	it('rejects missing key', () => {
		const result = validateAccessKey(null);
		expect(result.valid).toBe(false);
		expect(result.reason).toBe('not_found');
	});

	it('rejects inactive key', () => {
		const mockKey = {
			id: 'key_2',
			projectId: 'proj_1',
			name: 'Inactive Key',
			code: 'INACTIVE',
			maxUses: 20,
			usedCount: 0,
			expiresAt: null,
			isActive: false,
			createdAt: new Date()
		};

		const result = validateAccessKey(mockKey as unknown as Parameters<typeof validateAccessKey>[0]);
		expect(result.valid).toBe(false);
		expect(result.reason).toBe('inactive');
	});

	it('rejects key exceeding maxUses capacity', () => {
		const mockKey = {
			id: 'key_3',
			projectId: 'proj_1',
			name: 'Full Key',
			code: 'FULL-KEY',
			maxUses: 20,
			usedCount: 20,
			expiresAt: null,
			isActive: true,
			createdAt: new Date()
		};

		const result = validateAccessKey(mockKey as unknown as Parameters<typeof validateAccessKey>[0]);
		expect(result.valid).toBe(false);
		expect(result.reason).toBe('limit_exceeded');
	});

	it('rejects expired key', () => {
		const pastDate = new Date(Date.now() - 1000 * 60 * 60);
		const mockKey = {
			id: 'key_4',
			projectId: 'proj_1',
			name: 'Expired Key',
			code: 'EXPIRED',
			maxUses: 20,
			usedCount: 0,
			expiresAt: pastDate,
			isActive: true,
			createdAt: new Date()
		};

		const result = validateAccessKey(mockKey as unknown as Parameters<typeof validateAccessKey>[0]);
		expect(result.valid).toBe(false);
		expect(result.reason).toBe('expired');
	});
});
