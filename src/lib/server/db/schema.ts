import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const task = sqliteTable('task', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

import { user } from './auth.schema';

// Profile
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

// IsItFun Platform Tables
export const projects = sqliteTable('projects', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => generateNanoID(12)), // Generated NanoID string
	userId: text('userId')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	passwordProtected: integer('passwordProtected', { mode: 'boolean' }).default(false),
	passwordHash: text('passwordHash'),
	tier: text('tier').default('free'), // 'free' | 'pro'
	createdAt: integer('createdAt', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const telemetrySessions = sqliteTable('telemetry_sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()), // Generated per testing game initialization
	projectId: text('projectId')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	deviceHash: text('deviceHash').notNull(), // Salted SHA256 IP for GDPR anonymity
	browserInfo: text('browserInfo'),
	duration: integer('duration').default(0), // Aggregated in-game time in seconds
	createdAt: integer('createdAt', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const telemetryLogs = sqliteTable('telemetry_logs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	sessionId: text('sessionId')
		.notNull()
		.references(() => telemetrySessions.id, { onDelete: 'cascade' }),
	projectId: text('projectId')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	logType: text('logType').notNull(), // 'error' | 'log' | 'heartbeat' | 'bug_report'
	payload: text('payload').notNull(), // Text-serialized JSON object
	timestamp: integer('timestamp', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
});

export * from './auth.schema';
