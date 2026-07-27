import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { eq, and } from 'drizzle-orm';
import { projects, projectAccessKeys } from '$lib/server/db/db-schema';
import { hashPassword } from '$lib/server/crypto';
import { validateAccessKey } from '$lib/server/db/access-keys';

export const load: PageServerLoad = async ({ url, locals, cookies }) => {
	const projectId = url.searchParams.get('projectId');
	const urlError = url.searchParams.get('error');

	if (!projectId) {
		return { notFound: true, projectId: '', projectName: '', urlError: null };
	}

	const project = await locals.db.select().from(projects).where(eq(projects.id, projectId)).get();

	if (!project) {
		return { notFound: true, projectId, projectName: '', urlError: null };
	}

	// Check for active keys
	const keys = await locals.db
		.select()
		.from(projectAccessKeys)
		.where(and(eq(projectAccessKeys.projectId, projectId), eq(projectAccessKeys.isActive, true)))
		.all();

	const keyCookie = cookies.get(`play_key_${projectId}`);
	const legacyCookie = cookies.get(`play_auth_${projectId}`);

	if (keys.length > 0) {
		const matchingKey = keys.find((k) => k.code.toUpperCase() === (keyCookie || '').toUpperCase());
		const validation = validateAccessKey(matchingKey);
		if (validation.valid) {
			throw redirect(302, `/play/${projectId}`);
		}
	} else if (!project.passwordProtected || legacyCookie === project.passwordHash) {
		throw redirect(302, `/play/${projectId}`);
	}

	let errorMessage: string | null = null;
	if (urlError === 'limit_exceeded') {
		errorMessage = 'This playtest access key has reached its maximum playtester limit.';
	} else if (urlError === 'expired') {
		errorMessage = 'This playtest access key has expired.';
	} else if (urlError === 'inactive') {
		errorMessage = 'This playtest access key is currently deactivated.';
	}

	return {
		projectName: project.name,
		projectId: project.id,
		urlError: errorMessage
	};
};

export const actions: Actions = {
	verify: async ({ request, locals }) => {
		const formData = await request.formData();
		const projectId = formData.get('projectId') as string;
		const passwordInput = ((formData.get('password') as string) || '').trim();

		if (!projectId || !passwordInput) {
			return fail(400, { missing: true });
		}

		const project = await locals.db.select().from(projects).where(eq(projects.id, projectId)).get();

		if (!project) {
			return fail(404, { error: 'Project not found' });
		}

		// First check matching access key code
		const keys = await locals.db
			.select()
			.from(projectAccessKeys)
			.where(and(eq(projectAccessKeys.projectId, projectId), eq(projectAccessKeys.isActive, true)))
			.all();

		const matchingKey = keys.find((k) => k.code.toUpperCase() === passwordInput.toUpperCase());
		if (matchingKey) {
			const validation = validateAccessKey(matchingKey);
			if (!validation.valid) {
				if (validation.reason === 'limit_exceeded') {
					return fail(400, { error: 'This access key has reached its playtester capacity limit.' });
				} else if (validation.reason === 'expired') {
					return fail(400, { error: 'This access key has expired.' });
				} else {
					return fail(400, { error: 'Access key is inactive or invalid.' });
				}
			}

			// Redirect directly to play URL with key query param to trigger increment
			throw redirect(302, `/play/${projectId}?key=${encodeURIComponent(matchingKey.code)}`);
		}

		// Fallback to legacy static password
		if (project.passwordProtected && project.passwordHash) {
			const hashed = await hashPassword(passwordInput, projectId);
			if (hashed === project.passwordHash) {
				throw redirect(302, `/play/${projectId}`);
			}
		}

		return fail(400, { incorrect: true });
	}
};
