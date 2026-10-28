import { TierLimits } from '@isitfun/shared';

export interface EntitlementContext {
	projectTier?: 'free' | 'pro' | null;
	orgTier?: 'free' | 'pro' | 'team' | null;
	orgSubscriptionStatus?: string | null;
}

/**
 * Derives the effective tier for a project based on its own tier and its parent organization.
 * Hierarchy:
 * 1. If parent organization is on an active 'team' plan -> 'team'
 * 2. If project has a 'pro' pass -> 'pro'
 * 3. Default fallback -> 'free'
 */
export function getEffectiveTier(
	projectTier?: 'free' | 'pro' | null,
	orgTier?: 'free' | 'pro' | 'team' | null,
	orgSubscriptionStatus?: string | null
): 'free' | 'pro' | 'team' {
	if (orgTier === 'team' && orgSubscriptionStatus === 'active') {
		return 'team';
	}
	if (projectTier === 'pro') {
		return 'pro';
	}
	return 'free';
}

export function getTierLimits(tier: 'free' | 'pro' | 'team') {
	return TierLimits[tier] || TierLimits.free;
}
