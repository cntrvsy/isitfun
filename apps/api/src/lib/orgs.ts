import { eq, and } from 'drizzle-orm';
import { type DrizzleClient, schema } from '@isitfun/db';

/**
 * Ensures that the given user has an active personal organization.
 * If one does not exist, it is created along with an owner membership record.
 * This function is strictly idempotent.
 */
export async function ensurePersonalOrganization(
	db: DrizzleClient,
	user: { id: string; name?: string | null }
): Promise<typeof schema.organizations.$inferSelect> {
	// 1. Check for existing personal organization
	const existing = await db
		.select()
		.from(schema.organizations)
		.where(
			and(
				eq(schema.organizations.ownerId, user.id),
				eq(schema.organizations.type, 'personal')
			)
		)
		.get();

	if (existing) {
		// Ensure owner membership also exists (idempotency safety)
		const membership = await db
			.select()
			.from(schema.organizationMemberships)
			.where(
				and(
					eq(schema.organizationMemberships.organizationId, existing.id),
					eq(schema.organizationMemberships.userId, user.id)
				)
			)
			.get();

		if (!membership) {
			await db.insert(schema.organizationMemberships).values({
				id: crypto.randomUUID(),
				organizationId: existing.id,
				userId: user.id,
				role: 'owner',
				createdAt: new Date()
			});
		}

		return existing;
	}

	// 2. Create new personal organization
	const orgId = schema.generateNanoID(12);
	const now = new Date();
	const orgName = user.name ? `${user.name.trim()}'s Workspace` : 'Personal Workspace';

	const newOrg = {
		id: orgId,
		name: orgName,
		ownerId: user.id,
		type: 'personal' as const,
		tier: 'free' as const,
		createdAt: now
	};

	await db.insert(schema.organizations).values(newOrg);

	await db.insert(schema.organizationMemberships).values({
		id: crypto.randomUUID(),
		organizationId: orgId,
		userId: user.id,
		role: 'owner',
		createdAt: now
	});

	return newOrg as typeof schema.organizations.$inferSelect;
}

/**
 * Retrieves the personal organization for a user, creating one if not found.
 */
export async function getUserPersonalOrg(
	db: DrizzleClient,
	user: { id: string; name?: string | null }
): Promise<typeof schema.organizations.$inferSelect> {
	return ensurePersonalOrganization(db, user);
}
