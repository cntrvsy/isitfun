import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';

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
 * @strata {"target":"d1","x":-150,"y":-15}
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
 * @strata {"target":"d1","x":495,"y":-75}
 */
export const projects = sqliteTable('projects', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => generateNanoID(12)),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	passwordProtected: integer('password_protected', { mode: 'boolean' }).default(false),
	passwordHash: text('password_hash'),
	tier: text('tier').default('free'), // 'free' | 'project_pass'
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * @strata {"target":"d1","x":900,"y":0}
 */
export const gameBuilds = sqliteTable('game_builds', {
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
});

/**
 * @strata {"target":"d1","x":645,"y":390}
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
 * @strata {"target":"d1","x":-300,"y":270}
 */
export const payments = sqliteTable('payments', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
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
 * @strata {"target":"d1","x":210,"y":-75}
 */
export const processedWebhooks = sqliteTable('processed_webhooks', {
	id: text('id').primaryKey(),
	processedAt: integer('processed_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * @strata {"target":"d1","x":-45,"y":660}
 */
export const telemetrySessions = sqliteTable('telemetry_sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	deviceHash: text('device_hash').notNull(), // Salted SHA256 IP signature for UK GDPR
	browserInfo: text('browser_info'),
	duration: integer('duration').default(0), // Length of play in seconds
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * @strata {"target":"d1","x":435,"y":690}
 */
export const telemetryLogs = sqliteTable('telemetry_logs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	sessionId: text('session_id')
		.notNull()
		.references(() => telemetrySessions.id, { onDelete: 'cascade' }),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	logType: text('log_type').notNull(), // 'error' | 'log' | 'heartbeat'
	payload: text('payload').notNull(), // Text-serialized payload block
	timestamp: integer('timestamp', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * @strata {"target":"d1","x":930,"y":555}
 */
export const bugReports = sqliteTable('bug_reports', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	sessionId: text('session_id')
		.notNull()
		.references(() => telemetrySessions.id, { onDelete: 'cascade' }),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	userComment: text('user_comment').notNull(),
	screenshotR2Key: text('screenshot_r2_key'), // Storage object path in R2
	logsSnapshot: text('logs_snapshot'), // Bundled contextual text strings
	timestamp: integer('timestamp', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

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
	gameBuilds: many(gameBuilds),
	projectQuotas: many(projectQuotas),
	payments: many(payments),
	telemetrySessions: many(telemetrySessions),
	telemetryLogs: many(telemetryLogs),
	bugReports: many(bugReports)
}));

export const gameBuildsRelations = relations(gameBuilds, ({ one }) => ({
	project: one(projects, {
		fields: [gameBuilds.projectId],
		references: [projects.id]
	})
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
	telemetryLogs: many(telemetryLogs),
	bugReports: many(bugReports)
}));

export const telemetryLogsRelations = relations(telemetryLogs, ({ one }) => ({
	session: one(telemetrySessions, {
		fields: [telemetryLogs.sessionId],
		references: [telemetrySessions.id]
	}),
	project: one(projects, {
		fields: [telemetryLogs.projectId],
		references: [projects.id]
	})
}));

export const bugReportsRelations = relations(bugReports, ({ one }) => ({
	session: one(telemetrySessions, {
		fields: [bugReports.sessionId],
		references: [telemetrySessions.id]
	}),
	project: one(projects, {
		fields: [bugReports.projectId],
		references: [projects.id]
	})
}));

export * from './auth.schema';
