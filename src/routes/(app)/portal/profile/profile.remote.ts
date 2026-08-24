import { form, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { profile } from '#lib/server/db/db-schema.js';

export const updateProfile = form(
	v.object({
		firstName: v.pipe(v.string(), v.minLength(2, 'Must be at least 2 characters')),
		lastName: v.pipe(v.string(), v.minLength(2, 'Must be at least 2 characters')),
		organizationName: v.optional(v.string())
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');
		const { locals } = event;
		const { session, user, db } = locals;

		if (!session || !user) {
			error(401, 'Unauthorized');
		}

		try {
			const existingProfile = await db
				.select()
				.from(profile)
				.where(eq(profile.userId, user.id))
				.get();

			if (existingProfile) {
				await db
					.update(profile)
					.set({
						firstName: data.firstName.trim(),
						lastName: data.lastName.trim(),
						organizationName: data.organizationName?.trim() || null
					})
					.where(eq(profile.userId, user.id));
			} else {
				await db.insert(profile).values({
					userId: user.id,
					firstName: data.firstName.trim(),
					lastName: data.lastName.trim(),
					organizationName: data.organizationName?.trim() || null
				});
			}

			return { success: true };
		} catch (err) {
			console.error('Failed to update profile:', err);
			error(500, 'Database update failed');
		}
	}
);
