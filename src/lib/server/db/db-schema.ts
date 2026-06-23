import { relations, sql } from 'drizzle-orm';
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
 * @strata {"target":"d1","x":2176,"y":1176}
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
 * @strata {"target":"d1","x":2152,"y":850}
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
 * @strata {"target":"d1","x":1666,"y":582}
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
		index('org_mem_userId_idx').on(table.userId)
	]
);

/**
 * @strata {"target":"d1","x":1700,"y":205}
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
 * @strata {"target":"d1","x":1679,"y":921}
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
 * @strata {"target":"d1","x":1244,"y":905}
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
		r2FolderPath: text('r2_folder_path').notNull(), // Target path reference inside R2
		totalSizeBytes: integer('total_size_bytes').notNull().default(0),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		uploadedAt: integer('uploaded_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [index('game_builds_projectId_idx').on(table.projectId)]
);

/**
 * @strata {"target":"d1","x":1232,"y":528}
 */
export const projectQuotas = sqliteTable('project_quotas', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	monthlyWriteCount: integer('monthly_write_count').notNull().default(0),
	maxWriteLimit: integer('max_write_limit').notNull().default(100000), // Safety shield limit
	storageBytesUsed: integer('storage_bytes_used').notNull().default(0),
	lastResetAt: integer('last_reset_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * @strata {"target":"d1","x":1248,"y":50}
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
	status: text('status').notNull(), // 'pending' | 'completed' | 'failed' | 'refunded'
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * @strata {"target":"d1","x":750,"y":135}
 */
export const processedWebhooks = sqliteTable('processed_webhooks', {
	id: text('id').primaryKey(),
	processedAt: integer('processed_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * @strata {"target":"d1","x":797,"y":916}
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
		deviceHash: text('device_hash').notNull(), // Salted SHA256 IP signature for UK GDPR
		browserInfo: text('browser_info'),
		duration: integer('duration').default(0), // Length of play in seconds
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		index('telemetry_sessions_projectId_idx').on(table.projectId),
		index('telemetry_sessions_gameBuildId_idx').on(table.gameBuildId)
	]
);

/**
 * @strata {"target":"d1","x":495,"y":735}
 */
/**
 * @strata {"target":"d1","x":495,"y":735}
 */
export const customDeveloperLogs = sqliteTable(
	'custom_developer_logs',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		sessionId: text('session_id')
			.notNull()
			.references(() => telemetrySessions.id, { onDelete: 'cascade' }),
		eventName: text('event_name').notNull(),
		payload: text('payload').notNull().default('{}'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		index('log_project_event_idx').on(table.projectId, table.eventName),
		index('log_session_idx').on(table.sessionId)
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
	customDeveloperLogs: many(customDeveloperLogs)
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

export const telemetrySessionsRelations = relations(telemetrySessions, ({ many, one }) => ({
	project: one(projects, {
		fields: [telemetrySessions.projectId],
		references: [projects.id]
	}),
	gameBuild: one(gameBuilds, {
		fields: [telemetrySessions.gameBuildId],
		references: [gameBuilds.id]
	}),
	customDeveloperLogs: many(customDeveloperLogs)
}));

export const customDeveloperLogsRelations = relations(customDeveloperLogs, ({ one }) => ({
	project: one(projects, {
		fields: [customDeveloperLogs.projectId],
		references: [projects.id]
	}),
	session: one(telemetrySessions, {
		fields: [customDeveloperLogs.sessionId],
		references: [telemetrySessions.id]
	})
}));

export * from './auth-schema';
