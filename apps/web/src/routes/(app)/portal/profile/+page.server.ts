import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { profile } from '#lib/server/db/db-schema.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.session || !locals.user) {
		redirect(302, '/auth');
	}

	const userProfile = await locals.db
		.select()
		.from(profile)
		.where(eq(profile.userId, locals.user.id))
		.get();

	return {
		user: locals.user,
		profile: userProfile || null
	};
};
