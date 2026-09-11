import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { validateAccessKey } from '@isitfun/shared';

export const load: PageServerLoad = async ({ url, locals, cookies }) => {
	const projectId = url.searchParams.get('projectId');
	const urlError = url.searchParams.get('error');

	if (!projectId) {
		return { notFound: true, projectId: '', projectName: '', urlError: null };
	}

	const res = await locals.api.v1.projects[':id'].public.$get({
		param: { id: projectId }
	});

	if (!res.ok) {
		return { notFound: true, projectId, projectName: '', urlError: null };
	}

	const project = await res.json();

	const keyCookie = cookies.get(`play_key_${projectId}`);
	const legacyCookie = cookies.get(`play_auth_${projectId}`);

	if (project.keys && project.keys.length > 0) {
		const matchingKey = project.keys.find(
			(k: { code: string }) => k.code.toUpperCase() === (keyCookie || '').toUpperCase()
		);
		if (matchingKey) {
			const validation = validateAccessKey({
				isActive: matchingKey.isActive,
				expiresAt: matchingKey.expiresAt ? new Date(matchingKey.expiresAt) : null,
				maxUses: matchingKey.maxUses,
				usedCount: matchingKey.usedCount
			});
			if (validation.valid) {
				throw redirect(302, `/play/${projectId}`);
			}
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
	verify: async ({ request, locals, cookies }) => {
		const formData = await request.formData();
		const projectId = formData.get('projectId') as string;
		const passwordInput = ((formData.get('password') as string) || '').trim();

		if (!projectId || !passwordInput) {
			return fail(400, { missing: true });
		}

		const res = await locals.api.v1.projects[':id']['verify-key'].$post({
			param: { id: projectId },
			json: { password: passwordInput }
		});

		if (!res.ok) {
			const data = (await res.json().catch(() => ({}))) as {
				reason?: string;
				error?: string;
			};
			if (res.status === 404) {
				return fail(404, { error: 'Project not found' });
			}
			if (data.reason === 'limit_exceeded') {
				return fail(400, {
					error: 'This access key has reached its playtester capacity limit.'
				});
			} else if (data.reason === 'expired') {
				return fail(400, { error: 'This access key has expired.' });
			} else if (data.reason === 'inactive') {
				return fail(400, { error: 'Access key is inactive or invalid.' });
			} else {
				return fail(400, { incorrect: true });
			}
		}

		const data = (await res.json()) as {
			valid: boolean;
			isKey?: boolean;
			key?: string;
			isStatic?: boolean;
			hash?: string;
		};

		if (data.valid) {
			if (data.isKey && data.key) {
				throw redirect(302, `/play/${projectId}?key=${encodeURIComponent(data.key)}`);
			}
			if (data.isStatic && data.hash) {
				cookies.set(`play_auth_${projectId}`, data.hash, {
					path: `/play/${projectId}`,
					maxAge: 60 * 60 * 24 * 7, // 7 days
					sameSite: 'lax',
					httpOnly: true,
					secure: true
				});
				throw redirect(302, `/play/${projectId}`);
			}
		}

		return fail(400, { incorrect: true });
	}
};
