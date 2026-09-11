import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies, locals }) => {
	const token = url.searchParams.get('token');
	if (!token) {
		throw error(400, 'Missing invitation token');
	}

	const res = await locals.api.v1.orgs.invites.token[':token'].$get({
		param: { token }
	});

	if (!res.ok) {
		if (res.status === 404) {
			throw error(404, 'Invitation not found or has been revoked');
		}
		if (res.status === 410) {
			throw error(410, 'This invitation has expired');
		}
		throw error(res.status, 'Failed to validate invitation');
	}

	// Drop a secure cookie to store the invite token across the login flow
	cookies.set('pending_invite_token', token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 // 24 hours
	});

	// Redirect to auth portal to complete sign in handshake
	throw redirect(302, '/auth');
};
