import { form, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { UpdateProfileSchema } from '@isitfun/shared';

export const updateProfile = form(UpdateProfileSchema, async (data) => {
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
			organizationName: data.organizationName?.trim() || undefined
		}
	});

	if (!res.ok) {
		const err = (await res.json().catch(() => ({}))) as { error?: string };
		error(res.status, err.error || 'Failed to update profile');
	}

	return { success: true };
});
