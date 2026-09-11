import { form, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

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
			const res = await event.locals.auth.api.signUpEmail({
				body: {
					name: data.name.trim(),
					email: data.email.trim().toLowerCase(),
					password: data.password
				}
			});

			return { success: true, user: res.user };
		} catch (err: unknown) {
			console.error('[auth.remote] Failed sign up:', err);
			const errorObj = err as { message?: string; body?: { message?: string } };
			const msg = errorObj?.message || errorObj?.body?.message || 'Failed to create account';
			error(400, msg);
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
			const res = await event.locals.auth.api.signInEmail({
				body: {
					email: data.email.trim().toLowerCase(),
					password: data.password
				}
			});

			return { success: true, user: res.user };
		} catch (err: unknown) {
			console.error('[auth.remote] Failed sign in:', err);
			const errorObj = err as { message?: string; body?: { message?: string } };
			const msg = errorObj?.message || errorObj?.body?.message || 'Invalid email or password';
			error(400, msg);
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
			await (
				event.locals.auth.api as unknown as {
					forgetPassword: (options: {
						body: { email: string; redirectTo: string };
					}) => Promise<unknown>;
				}
			).forgetPassword({
				body: {
					email: data.email.trim().toLowerCase(),
					redirectTo
				}
			});

			return { success: true };
		} catch (err: unknown) {
			console.error('[auth.remote] Failed forgot password:', err);
			const errorObj = err as { message?: string; body?: { message?: string } };
			const msg =
				errorObj?.message || errorObj?.body?.message || 'Failed to send password reset email';
			error(400, msg);
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
			await event.locals.auth.api.resetPassword({
				body: {
					newPassword: data.newPassword,
					token: data.token
				}
			});

			return { success: true };
		} catch (err: unknown) {
			console.error('[auth.remote] Failed reset password:', err);
			const errorObj = err as { message?: string; body?: { message?: string } };
			const msg =
				errorObj?.message ||
				errorObj?.body?.message ||
				'Failed to reset password. Token may have expired.';
			error(400, msg);
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
			await event.locals.auth.api.sendVerificationEmail({
				body: {
					email: data.email.trim().toLowerCase(),
					callbackURL: `${event.url.origin}/auth`
				}
			});

			return { success: true };
		} catch (err: unknown) {
			console.error('[auth.remote] Failed resend verification:', err);
			const errorObj = err as { message?: string; body?: { message?: string } };
			const msg =
				errorObj?.message || errorObj?.body?.message || 'Failed to send verification email';
			error(400, msg);
		}
	}
);
