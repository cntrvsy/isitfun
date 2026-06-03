import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { eq } from 'drizzle-orm';
import { projects } from '$lib/server/db/schema';

// Helper to hash passwords using native Edge Web Crypto
async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const load: PageServerLoad = async ({ url, locals, cookies }) => {
	const projectId = url.searchParams.get('projectId');
	if (!projectId) {
		throw error(400, 'Missing projectId parameter');
	}

	const project = await locals.db.select().from(projects).where(eq(projects.id, projectId)).get();

	if (!project) {
		throw error(404, 'Playtest project not found');
	}

	// If the project is not password protected, or if they are already authenticated, redirect straight to play
	if (!project.passwordProtected) {
		throw redirect(302, `/play/${projectId}`);
	}

	const authCookie = cookies.get(`play_auth_${projectId}`);
	if (authCookie === project.passwordHash) {
		throw redirect(302, `/play/${projectId}`);
	}

	return {
		projectName: project.name,
		projectId: project.id
	};
};

export const actions: Actions = {
	verify: async ({ request, locals, cookies }) => {
		const formData = await request.formData();
		const projectId = formData.get('projectId') as string;
		const password = formData.get('password') as string;

		if (!projectId || !password) {
			return fail(400, { missing: true });
		}

		const project = await locals.db.select().from(projects).where(eq(projects.id, projectId)).get();

		if (!project) {
			return fail(404, { error: 'Project not found' });
		}

		const hashed = await hashPassword(password);
		if (hashed === project.passwordHash) {
			// Set play auth cookie valid for 7 days, scoped strictly to `/play` to keep game proxy secure
			cookies.set(`play_auth_${projectId}`, project.passwordHash, {
				path: '/play',
				maxAge: 60 * 60 * 24 * 7, // 7 days
				sameSite: 'lax',
				httpOnly: true,
				secure: true
			});

			throw redirect(302, `/play/${projectId}`);
		}

		return fail(400, { incorrect: true });
	}
};
