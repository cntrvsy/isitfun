import { relations } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { user } from './auth';
import { organizations } from './orgs';
import { generateNanoID } from './utils';

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

export const projectsRelations = relations(projects, ({ one, many }) => ({
	user: one(user, {
		fields: [projects.userId],
		references: [user.id]
	}),
	organization: one(organizations, {
		fields: [projects.organizationId],
		references: [organizations.id]
	}),
	accessKeys: many(projectAccessKeys),
	quotas: many(projectQuotas)
}));

export const projectAccessKeysRelations = relations(projectAccessKeys, ({ one }) => ({
	project: one(projects, {
		fields: [projectAccessKeys.projectId],
		references: [projects.id]
	})
}));

export const projectQuotasRelations = relations(projectQuotas, ({ one }) => ({
	project: one(projects, {
		fields: [projectQuotas.projectId],
		references: [projects.id]
	})
}));
