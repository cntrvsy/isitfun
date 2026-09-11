import { form, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

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

		if (!locals.session || !locals.user) {
			error(401, 'Unauthorized');
		}

		const res = await locals.api.v1.profile.$patch({
			json: {
				firstName: data.firstName.trim(),
				lastName: data.lastName.trim(),
				organizationName: data.organizationName?.trim() || null
			}
		});

		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as { error?: string };
			error(res.status, err.error || 'Failed to update profile');
		}

		return { success: true };
	}
);
