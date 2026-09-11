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
