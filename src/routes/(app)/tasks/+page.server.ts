import { fail } from '@sveltejs/kit';
import { task } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const tasks = await locals.db.select().from(task).orderBy(task.priority);
	return { tasks };
};

export const actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const title = formData.get('title');
		const priority = formData.get('priority');

		if (!title || typeof title !== 'string') {
			return fail(400, { title, missing: true });
		}

		await locals.db.insert(task).values({
			title,
			priority: priority ? parseInt(priority.toString()) : 1
		});

		return { success: true };
	},

	update: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id');
		const title = formData.get('title');
		const priority = formData.get('priority');

		if (!id || typeof id !== 'string') {
			return fail(400, { id, missing: true });
		}
		if (!title || typeof title !== 'string') {
			return fail(400, { title, missing: true });
		}

		await locals.db
			.update(task)
			.set({
				title,
				priority: priority ? parseInt(priority.toString()) : 1
			})
			.where(eq(task.id, id));

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id');

		if (!id || typeof id !== 'string') {
			return fail(400, { id, missing: true });
		}

		await locals.db.delete(task).where(eq(task.id, id));

		return { success: true };
	}
} satisfies Actions;
