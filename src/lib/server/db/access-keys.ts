import { projectAccessKeys } from './db-schema';

export const TIER_KEY_HARD_CAPS: Record<string, number> = {
	free: 20,
	pro: 100,
	team: 1000
};

export function getMaxUsesCapForTier(tier: string = 'free'): number {
	return TIER_KEY_HARD_CAPS[tier] || TIER_KEY_HARD_CAPS.free;
}

export interface ValidateKeyResult {
	valid: boolean;
	reason?: 'not_found' | 'inactive' | 'expired' | 'limit_exceeded';
	key?: typeof projectAccessKeys.$inferSelect;
}

/**
 * Validates an access key for a project.
 */
export function validateAccessKey(
	keyRecord: typeof projectAccessKeys.$inferSelect | null | undefined
): ValidateKeyResult {
	if (!keyRecord) {
		return { valid: false, reason: 'not_found' };
	}

	if (!keyRecord.isActive) {
		return { valid: false, reason: 'inactive', key: keyRecord };
	}

	if (keyRecord.expiresAt && keyRecord.expiresAt.getTime() < Date.now()) {
		return { valid: false, reason: 'expired', key: keyRecord };
	}

	if (keyRecord.maxUses !== null && keyRecord.usedCount >= keyRecord.maxUses) {
		return { valid: false, reason: 'limit_exceeded', key: keyRecord };
	}

	return { valid: true, key: keyRecord };
}
