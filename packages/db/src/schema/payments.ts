import { relations } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { user } from './auth';
import { projects } from './projects';

export const payments = sqliteTable(
	'payments',
	{
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
	},
	(table) => [
		index('payments_projectId_idx').on(table.projectId),
		index('payments_userId_idx').on(table.userId)
	]
);

export const processedWebhooks = sqliteTable('processed_webhooks', {
	id: text('id').primaryKey(),
	eventType: text('event_type').notNull(),
	processedAt: integer('processed_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

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
