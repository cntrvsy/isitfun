import { form, getRequestEvent } from '$app/server';
import type { RequestEvent } from '@sveltejs/kit';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

async function callAuthEndpoint(
	event: RequestEvent,
	endpoint: string,
	body: Record<string, unknown>
) {
	const isDev = import.meta.env.DEV;
	const serviceFetch =
		!isDev && event.platform?.env?.API?.fetch
			? event.platform.env.API.fetch.bind(event.platform.env.API)
			: fetch;
	const authBase =
		!isDev && event.platform?.env?.API
			? 'https://api.internal/v1/auth'
			: 'http://localhost:8787/v1/auth';

	const res = await serviceFetch(`${authBase}${endpoint}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			cookie: event.request.headers.get('cookie') || ''
		},
		body: JSON.stringify(body)
	});

	// Forward any Set-Cookie headers returned by Better-Auth to the user's browser
	const cookieStrings = res.headers.getSetCookie
		? res.headers.getSetCookie()
		: ([res.headers.get('set-cookie')].filter(Boolean) as string[]);

	for (const str of cookieStrings) {
		const parts = (str as string).split(';').map((p: string) => p.trim());
		const [nameVal, ...attrs] = parts;
		const [name, ...valParts] = nameVal.split('=');
		const value = valParts.join('=');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const options: Record<string, any> = { path: '/' };
		for (const attr of attrs) {
			const [k, v] = attr.split('=');
			const lowerK = k.toLowerCase();
			if (lowerK === 'max-age') options.maxAge = parseInt(v, 10);
			else if (lowerK === 'domain') options.domain = v;
			else if (lowerK === 'httponly') options.httpOnly = true;
			else if (lowerK === 'secure') options.secure = true;
			else if (lowerK === 'samesite') options.sameSite = v.toLowerCase();
		}
		event.cookies.set(name, value, options);
	}

	if (!res.ok) {
		const errData = (await res.json().catch(() => ({ message: 'Auth request failed' }))) as {
			message?: string;
		};
		throw new Error(errData?.message || 'Authentication error');
	}

	return await res.json().catch(() => ({ success: true }));
}

export const signUpWithEmail = form(
	v.object({
		name: v.pipe(v.string(), v.nonEmpty('Full name is required')),
		email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email address')),
		password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters long'))
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');

		try {
			const res = (await callAuthEndpoint(event, '/sign-up/email', {
				name: data.name.trim(),
				email: data.email.trim().toLowerCase(),
				password: data.password
			})) as { user?: unknown };

			return { success: true, user: res.user };
		} catch (err: unknown) {
			console.error('[auth.remote] Failed sign up:', err);
			const errorObj = err as { message?: string };
			error(400, errorObj?.message || 'Failed to create account');
		}
	}
);

export const signInWithEmail = form(
	v.object({
		email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email address')),
		password: v.pipe(v.string(), v.nonEmpty('Password is required'))
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');

		try {
			const res = (await callAuthEndpoint(event, '/sign-in/email', {
				email: data.email.trim().toLowerCase(),
				password: data.password
			})) as { user?: unknown };

			return { success: true, user: res.user };
		} catch (err: unknown) {
			console.error('[auth.remote] Failed sign in:', err);
			const errorObj = err as { message?: string };
			error(400, errorObj?.message || 'Invalid email or password');
		}
	}
);

export const forgotPassword = form(
	v.object({
		email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email address'))
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');

		try {
			const redirectTo = `${event.url.origin}/auth/reset-password`;
			await callAuthEndpoint(event, '/forget-password', {
				email: data.email.trim().toLowerCase(),
				redirectTo
			});

			return { success: true };
		} catch (err: unknown) {
			console.error('[auth.remote] Failed forgot password:', err);
			const errorObj = err as { message?: string };
			error(400, errorObj?.message || 'Failed to send password reset email');
		}
	}
);

export const resetPassword = form(
	v.object({
		token: v.pipe(v.string(), v.nonEmpty('Reset token is missing or invalid')),
		newPassword: v.pipe(
			v.string(),
			v.minLength(8, 'New password must be at least 8 characters long')
		)
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');

		try {
			await callAuthEndpoint(event, '/reset-password', {
				newPassword: data.newPassword,
				token: data.token
			});

			return { success: true };
		} catch (err: unknown) {
			console.error('[auth.remote] Failed reset password:', err);
			const errorObj = err as { message?: string };
			error(400, errorObj?.message || 'Failed to reset password. Token may have expired.');
		}
	}
);

export const resendVerification = form(
	v.object({
		email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email address'))
	}),
	async (data) => {
		const event = getRequestEvent();
		if (!event) error(500, 'Request context missing');

		try {
			await callAuthEndpoint(event, '/send-verification-email', {
				email: data.email.trim().toLowerCase(),
				callbackURL: `${event.url.origin}/auth`
			});

			return { success: true };
		} catch (err: unknown) {
			console.error('[auth.remote] Failed resend verification:', err);
			const errorObj = err as { message?: string };
			error(400, errorObj?.message || 'Failed to send verification email');
		}
	}
);
