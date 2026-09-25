import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { vValidator } from '@hono/valibot-validator';
import { createD1Client, schema } from '@isitfun/db';
import { UpdateProfileSchema } from '@isitfun/shared';
import type { AppEnv } from '../../types';
import { sessionMiddleware, requireAuth } from '../../middleware/auth';

export const profileRouter = new Hono<AppEnv>()
	.use('*', sessionMiddleware, requireAuth)
	// GET /v1/profile - Get current user profile
	.get('/', async (c) => {
		const user = c.get('user')!;
		const db = createD1Client(c.env.DB);

		const userProfile = await db
			.select()
			.from(schema.profile)
			.where(eq(schema.profile.userId, user.id))
			.get();

		return c.json({ profile: userProfile || null });
	})
	// PATCH /v1/profile - Upsert user profile
	.patch('/', vValidator('json', UpdateProfileSchema), async (c) => {
	const user = c.get('user')!;
	const data = c.req.valid('json');
	const db = createD1Client(c.env.DB);

	const existingProfile = await db
		.select()
		.from(schema.profile)
		.where(eq(schema.profile.userId, user.id))
		.get();

	const now = new Date();

	if (existingProfile) {
		await db
			.update(schema.profile)
			.set({
				firstName: data.firstName.trim(),
				lastName: data.lastName.trim(),
				organizationName: data.organizationName?.trim() || null,
				updatedAt: now
			})
			.where(eq(schema.profile.userId, user.id));
	} else {
		await db.insert(schema.profile).values({
			userId: user.id,
			firstName: data.firstName.trim(),
			lastName: data.lastName.trim(),
			organizationName: data.organizationName?.trim() || null,
			updatedAt: now
		});
	}

	return c.json({ success: true });
});
