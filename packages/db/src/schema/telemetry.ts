import { relations } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { projects } from './projects';
import { gameBuilds } from './builds';

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
		r2LogPath: text('r2_log_path'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		index('telemetry_sessions_projectId_idx').on(table.projectId),
		index('telemetry_sessions_buildId_idx').on(table.gameBuildId),
		index('telemetry_sessions_createdAt_idx').on(table.createdAt),
		index('telemetry_sessions_projectId_createdAt_idx').on(table.projectId, table.createdAt)
	]
);

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
