import * as v from 'valibot';

export type UserRole = 'game_developer' | 'admin';
export type OrgRole = 'owner' | 'admin' | 'member';
export type SubscriptionTier = 'free' | 'pro_pass' | 'team';
export type FeedbackSentiment = 'fun' | 'neutral' | 'unfun';

export const TierLimits = {
	free: {
		maxUsesPerKey: 20,
		maxMonthlyWrites: 5000,
		maxActiveProjects: 1
	},
	pro_pass: {
		maxUsesPerKey: 100,
		maxMonthlyWrites: 50000,
		maxActiveProjects: 5
	},
	team: {
		maxUsesPerKey: 1000,
		maxMonthlyWrites: 500000,
		maxActiveProjects: 50
	}
} as const;

export const TIER_KEY_HARD_CAPS: Record<string, number> = {
	free: 20,
	pro: 100,
	pro_pass: 100,
	team: 1000
};

export function getMaxUsesCapForTier(tier: string = 'free'): number {
	return TIER_KEY_HARD_CAPS[tier] || TIER_KEY_HARD_CAPS.free;
}

export * from './crypto';

export const TelemetryLogSchema = v.object({
	event: v.string(),
	data: v.unknown(),
	timestamp: v.optional(v.number())
});

export const TelemetryPayloadSchema = v.object({
	projectId: v.string(),
	sessionId: v.string(),
	logs: v.array(TelemetryLogSchema),
	hasCrashed: v.optional(v.boolean()),
	isExiting: v.optional(v.boolean()),
	deviceHash: v.string(),
	browserInfo: v.optional(v.string()),
	gameBuildId: v.optional(v.string()),
	avgFps: v.optional(v.nullable(v.number())),
	minFps: v.optional(v.nullable(v.number())),
	deviceSpecs: v.optional(
		v.nullable(
			v.object({
				hardwareConcurrency: v.optional(v.nullable(v.number())),
				deviceMemory: v.optional(v.nullable(v.number())),
				screenResolution: v.optional(v.string()),
				gpuRenderer: v.optional(v.nullable(v.string()))
			})
		)
	),
	feedback: v.optional(
		v.nullable(
			v.object({
				sentiment: v.optional(v.picklist(['fun', 'neutral', 'unfun'])),
				comment: v.optional(v.string())
			})
		)
	)
});

export type TelemetryPayload = v.InferOutput<typeof TelemetryPayloadSchema>;
export type TelemetryLog = v.InferOutput<typeof TelemetryLogSchema>;

export interface ValidateKeyResult<T = unknown> {
	valid: boolean;
	reason?: 'not_found' | 'inactive' | 'expired' | 'limit_exceeded';
	key?: T;
}

export function validateAccessKey<
	T extends {
		isActive: boolean;
		expiresAt?: Date | null;
		maxUses: number | null;
		usedCount: number;
	}
>(keyRecord: T | null | undefined): ValidateKeyResult<T> {
	if (!keyRecord) {
		return { valid: false, reason: 'not_found' };
	}
	if (!keyRecord.isActive) {
		return { valid: false, reason: 'inactive', key: keyRecord };
	}
	if (keyRecord.expiresAt && new Date(keyRecord.expiresAt).getTime() < Date.now()) {
		return { valid: false, reason: 'expired', key: keyRecord };
	}
	if (keyRecord.maxUses !== null && keyRecord.usedCount >= keyRecord.maxUses) {
		return { valid: false, reason: 'limit_exceeded', key: keyRecord };
	}
	return { valid: true, key: keyRecord };
}

export const CreateProjectSchema = v.object({
	name: v.pipe(v.string(), v.nonEmpty('Project name is required')),
	passwordProtected: v.optional(v.boolean(), false),
	password: v.optional(v.string()),
	organizationId: v.optional(v.nullable(v.string()))
});

export const UpdateProjectSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.nonEmpty('Project name is required'))),
	passwordProtected: v.optional(v.boolean()),
	password: v.optional(v.string())
});

export const CreateAccessKeySchema = v.object({
	name: v.pipe(v.string(), v.nonEmpty('Key name is required')),
	maxUses: v.optional(v.nullable(v.number())),
	expiresAt: v.optional(v.nullable(v.string()))
});

export const CreateOrgSchema = v.object({
	name: v.pipe(v.string(), v.nonEmpty('Organization name is required'))
});

export const InviteMemberSchema = v.object({
	email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email address')),
	role: v.optional(v.picklist(['admin', 'member']), 'member')
});

export const UpdateProfileSchema = v.object({
	firstName: v.pipe(v.string(), v.minLength(2, 'Must be at least 2 characters')),
	lastName: v.pipe(v.string(), v.minLength(2, 'Must be at least 2 characters')),
	organizationName: v.optional(v.nullable(v.string()))
});

export type CreateProjectInput = v.InferOutput<typeof CreateProjectSchema>;
export type UpdateProjectInput = v.InferOutput<typeof UpdateProjectSchema>;
export type CreateAccessKeyInput = v.InferOutput<typeof CreateAccessKeySchema>;
export type CreateOrgInput = v.InferOutput<typeof CreateOrgSchema>;
export type InviteMemberInput = v.InferOutput<typeof InviteMemberSchema>;
export type UpdateProfileInput = v.InferOutput<typeof UpdateProfileSchema>;
