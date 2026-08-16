import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { profileFormSchema } from '#lib/server/validation.js';
import { profile } from '#lib/server/db/db-schema.js';
import type { Actions } from './$types';

export const actions = {
	default: async ({ request, locals }) => {
		if (!locals.session || !locals.user) {
			return fail(401, { message: 'Unauthorized' });
		}

		// 1. Get the form data
		const formData = await request.formData();
		const rawData = Object.fromEntries(formData.entries());

		// 2. Validate using Valibot
		const result = v.safeParse(profileFormSchema, rawData);

		if (!result.success) {
			return fail(400, { issues: v.flatten<typeof profileFormSchema>(result.issues) });
		}

		// 3. Inject the authenticated user's ID
		const userId = locals.user.id;

		// 4. Save/Upsert to D1 Database
		const existingProfile = await locals.db
			.select()
			.from(profile)
			.where(eq(profile.userId, userId))
			.get();

		if (existingProfile) {
			await locals.db
				.update(profile)
				.set({
					firstName: result.output.firstName,
					lastName: result.output.lastName,
					organizationName: result.output.organizationName
				})
				.where(eq(profile.userId, userId));
		} else {
			await locals.db.insert(profile).values({
				...result.output,
				userId
			});
		}

		return { success: true };
	}
} satisfies Actions;
