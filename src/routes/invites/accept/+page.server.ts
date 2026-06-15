import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { organizationInvites } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ url, cookies, locals }) => {
	const token = url.searchParams.get('token');
	if (!token) {
		throw error(400, 'Missing invitation token');
	}

	const db = locals.db;
	const invite = await db
		.select()
		.from(organizationInvites)
		.where(eq(organizationInvites.token, token))
		.get();

	if (!invite) {
		throw error(404, 'Invitation not found or has been revoked');
	}

	if (new Date() > invite.expiresAt) {
		// Clean up expired invite
		await db.delete(organizationInvites).where(eq(organizationInvites.id, invite.id));
		throw error(410, 'This invitation has expired');
	}

	// Drop a secure cookie to store the invite token across the login flow
	cookies.set('pending_invite_token', token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 // 24 hours
	});

	// Redirect to login portal to complete Google or GitHub handshake
	throw redirect(302, '/auth/login');
};
