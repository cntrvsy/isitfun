import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { user } from './auth-schema';

// Helper for generating URL-safe NanoIDs on the edge
export function generateNanoID(size = 12): string {
	const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
	let id = '';
	const bytes = crypto.getRandomValues(new Uint8Array(size));
	for (let i = 0; i < size; i++) {
		id += alphabet[bytes[i] % alphabet.length];
	}
	return id;
}

/**
 * @strata { "target": "project", "wranglerPath": "../../../../wrangler.jsonc" }
 */
export const strataConfig = {};

/**
 * App KV namespace for cache & state.
 * @strata {"target":"kv","x":500,"y":100,"binding":"ISITFUN_KV","schema":{"sessionToken":"string","projectConfig":"object"}}
 */
export const ISITFUN_KV = {};

/**
 * Feature flag & remote config control KV namespace.
 * @strata {"target":"kv","x":900,"y":100,"binding":"DRIFTER_CONTROL","schema":{"featureFlags":"object","rateLimits":"number"}}
 */
export const DRIFTER_CONTROL = {};

/**
 * R2 Storage Bucket for uploaded game builds and static binaries.
 * @strata {"target":"r2","x":1300,"y":100,"binding":"GAMES_BUCKET","public":true,"cors":true,"folders":{"builds":"application/octet-stream"}}
 */
export const GAMES_BUCKET = {};

/**
 * Telemetry Buffer Durable Object for high-frequency edge log aggregation.
 * @strata {"target":"do","x":1700,"y":100,"binding":"TELEMETRY_BUFFER","class":"TelemetrySessionDO","path":"./src/lib/server/durable-objects/TelemetrySessionDO.ts","methods":["ingestLog","flushToD1"]}
 */
export const TELEMETRY_BUFFER = {};

/**
 * @strata {"target":"d1","x":100,"y":400}
 */
export const profile = sqliteTable('profile', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	firstName: text('first_name').notNull(),
	lastName: text('last_name').notNull(),
	organizationName: text('organization_name')
});

/**
 * @strata {"target":"d1","x":500,"y":400}
 */
export const organizations = sqliteTable('organizations', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	ownerId: text('owner_id')
		.notNull()
		.references(() => user.id),
	tier: text('tier').$type<'free' | 'team'>().default('free').notNull(),
	creemSubscriptionId: text('creem_subscription_id'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * @strata {"target":"d1","x":900,"y":400}
 */
export const organizationMemberships = sqliteTable(
	'organization_memberships',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: text('role').$type<'admin' | 'member'>().default('member').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		index('org_mem_orgId_idx').on(table.organizationId),
		index('org_mem_userId_idx').on(table.userId),
		index('org_mem_orgId_userId_idx').on(table.organizationId, table.userId)
	]
);

/**
 * @strata {"target":"d1","x":1300,"y":400}
 */
export const organizationInvites = sqliteTable(
	'organization_invites',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		token: text('token')
			.notNull()
			.unique()
			.$defaultFn(() => crypto.randomUUID()),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		index('org_inv_orgId_idx').on(table.organizationId),
		index('org_inv_token_idx').on(table.token)
	]
);

/**
 * @strata {"target":"d1","x":500,"y":700,"relations":[{"to":"ISITFUN_KV"}]}
 */
export const projects = sqliteTable(
	'projects',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => generateNanoID(12)),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		organizationId: text('organization_id').references(() => organizations.id, {
			onDelete: 'cascade'
		}),
		name: text('name').notNull(),
		passwordProtected: integer('password_protected', { mode: 'boolean' }).default(false),
		passwordHash: text('password_hash'),
		tier: text('tier').$type<'free' | 'pro'>().default('free'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		index('projects_userId_idx').on(table.userId),
		index('projects_orgId_idx').on(table.organizationId)
	]
);

/**
 * @strata {"target":"d1","x":900,"y":700}
 */
export const projectAccessKeys = sqliteTable(
	'project_access_keys',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		code: text('code').notNull().unique(),
		maxUses: integer('max_uses').notNull().default(20),
		usedCount: integer('used_count').notNull().default(0),
		expiresAt: integer('expires_at', { mode: 'timestamp' }),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		index('proj_keys_projectId_idx').on(table.projectId),
		index('proj_keys_code_idx').on(table.code)
	]
);

/**
 * @strata {"target":"d1","x":1300,"y":700}
 */
export const projectQuotas = sqliteTable('project_quotas', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	monthlyWriteCount: integer('monthly_write_count').notNull().default(0),
	maxWriteLimit: integer('max_write_limit').notNull().default(100000),
	storageBytesUsed: integer('storage_bytes_used').notNull().default(0),
	lastResetAt: integer('last_reset_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * @strata {"target":"d1","x":100,"y":1000}
 */
export const payments = sqliteTable('payments', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	creemCheckoutId: text('creem_checkout_id').unique(),
	creemOrderId: text('creem_order_id').unique(),
	creemCustomerId: text('creem_customer_id'),
	amount: integer('amount').notNull(),
	currency: text('currency').notNull().default('gbp'),
	status: text('status').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * Webhook Idempotency Ledger.
 * Soundness: Essential to prevent double-charging or duplicate tier upgrades on retried Creem webhooks.
 * @strata {"target":"d1","x":510,"y":1335,"relations":[{"to":"payments"}]}
 */
export const processedWebhooks = sqliteTable('processed_webhooks', {
	id: text('id').primaryKey(),
	processedAt: integer('processed_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * @strata {"target":"d1","x":900,"y":1300,"relations":[{"to":"GAMES_BUCKET"}]}
 */
export const gameBuilds = sqliteTable(
	'game_builds',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		versionString: text('version_string').notNull().default('1.0.0'),
		r2FolderPath: text('r2_folder_path').notNull(),
		totalSizeBytes: integer('total_size_bytes').notNull().default(0),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		uploadedAt: integer('uploaded_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [index('game_builds_projectId_idx').on(table.projectId)]
);

/**
 * @strata {"target":"d1","x":1300,"y":1300,"relations":[{"to":"TELEMETRY_BUFFER"}]}
 */
export const telemetrySessions = sqliteTable(
	'telemetry_sessions',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		gameBuildId: text('game_build_id').references(() => gameBuilds.id, { onDelete: 'set null' }),
		deviceHash: text('device_hash').notNull(),
		browserInfo: text('browser_info'),
		duration: integer('duration').default(0),
		logCount: integer('log_count').notNull().default(0),
		hasCrashed: integer('has_crashed', { mode: 'boolean' }).notNull().default(false),
		sentiment: text('sentiment').$type<'fun' | 'neutral' | 'unfun'>(),
		avgFps: integer('avg_fps'),
		userComment: text('user_comment'),
		gpuRenderer: text('gpu_renderer'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		index('telemetry_sessions_projectId_idx').on(table.projectId),
		index('telemetry_sessions_gameBuildId_idx').on(table.gameBuildId),
		index('telemetry_sessions_projectId_createdAt_idx').on(table.projectId, table.createdAt)
	]
);

// --- Logical Strata Graph Relations ---

export const profileRelations = relations(profile, ({ one }) => ({
	user: one(user, {
		fields: [profile.userId],
		references: [user.id]
	})
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
	user: one(user, {
		fields: [projects.userId],
		references: [user.id]
	}),
	organization: one(organizations, {
		fields: [projects.organizationId],
		references: [organizations.id]
	}),
	gameBuilds: many(gameBuilds),
	projectQuotas: many(projectQuotas),
	payments: many(payments),
	telemetrySessions: many(telemetrySessions),
	accessKeys: many(projectAccessKeys)
}));

export const projectAccessKeysRelations = relations(projectAccessKeys, ({ one }) => ({
	project: one(projects, {
		fields: [projectAccessKeys.projectId],
		references: [projects.id]
	})
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
	owner: one(user, {
		fields: [organizations.ownerId],
		references: [user.id]
	}),
	memberships: many(organizationMemberships),
	invites: many(organizationInvites),
	projects: many(projects)
}));

export const organizationMembershipsRelations = relations(organizationMemberships, ({ one }) => ({
	organization: one(organizations, {
		fields: [organizationMemberships.organizationId],
		references: [organizations.id]
	}),
	user: one(user, {
		fields: [organizationMemberships.userId],
		references: [user.id]
	})
}));

export const organizationInvitesRelations = relations(organizationInvites, ({ one }) => ({
	organization: one(organizations, {
		fields: [organizationInvites.organizationId],
		references: [organizations.id]
	})
}));

export const gameBuildsRelations = relations(gameBuilds, ({ one, many }) => ({
	project: one(projects, {
		fields: [gameBuilds.projectId],
		references: [projects.id]
	}),
	telemetrySessions: many(telemetrySessions)
}));

export const projectQuotasRelations = relations(projectQuotas, ({ one }) => ({
	project: one(projects, {
		fields: [projectQuotas.projectId],
		references: [projects.id]
	})
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
	project: one(projects, {
		fields: [payments.projectId],
		references: [projects.id]
	}),
	user: one(user, {
		fields: [payments.userId],
		references: [user.id]
	})
}));

export const processedWebhooksRelations = relations(processedWebhooks, () => ({}));

export const telemetrySessionsRelations = relations(telemetrySessions, ({ one }) => ({
	project: one(projects, {
		fields: [telemetrySessions.projectId],
		references: [projects.id]
	}),
	gameBuild: one(gameBuilds, {
		fields: [telemetrySessions.gameBuildId],
		references: [gameBuilds.id]
	})
}));

export * from './auth-schema';
