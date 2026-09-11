import { relations } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { projects } from './projects';

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

export const gameBuildsRelations = relations(gameBuilds, ({ one }) => ({
	project: one(projects, {
		fields: [gameBuilds.projectId],
		references: [projects.id]
	})
}));
