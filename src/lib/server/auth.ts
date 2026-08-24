import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { emailOTP } from 'better-auth/plugins';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import type { DrizzleClient } from '#lib/server/db/index.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '#lib/server/email.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authCache = new WeakMap<object, any>();

export const getAuth = (db: DrizzleClient, requestURL?: string) => {
	const dbKey = db as object;
	if (authCache.has(dbKey)) {
		return authCache.get(dbKey);
	}

	const baseURL =
		env.BETTER_AUTH_URL ||
		(env.ORIGIN ? `${env.ORIGIN}/api/auth` : requestURL ? `${requestURL}/api/auth` : '/api/auth');

	const trustedOrigins = [
		env.BETTER_AUTH_URL || '',
		env.ORIGIN || '',
		...(env.TRUSTED_ORIGINS?.split(',') || [])
	]
		.map((o) => o.trim())
		.filter(Boolean);

	if (requestURL && import.meta.env.DEV && !trustedOrigins.includes(requestURL)) {
		trustedOrigins.push(requestURL);
	}

	const instance = betterAuth({
		baseURL,
		secret: env.BETTER_AUTH_SECRET || 'dev-secret-change-in-production',
		database: drizzleAdapter(db, { provider: 'sqlite' }),
		trustedOrigins,
		emailAndPassword: {
			enabled: true,
			async sendResetPassword({ user, url, token }) {
				await sendPasswordResetEmail({ to: user.email, url, token });
			}
		},
		emailVerification: {
			sendVerificationEmail: async ({ user, url, token }) => {
				await sendVerificationEmail({ to: user.email, url, token });
			}
		},
		socialProviders: {
			github: {
				clientId: env.GITHUB_CLIENT_ID || '',
				clientSecret: env.GITHUB_CLIENT_SECRET || ''
			},
			google: {
				clientId: env.GOOGLE_CLIENT_ID || '',
				clientSecret: env.GOOGLE_CLIENT_SECRET || ''
			}
		},
		user: {
			additionalFields: {
				role: {
					type: 'string',
					defaultValue: 'game_developer',
					input: false
				}
			}
		},
		advanced: {
			defaultCookieAttributes: {
				path: '/'
			}
		},
		plugins: [
			emailOTP({
				async sendVerificationOTP({ email, otp, type }) {
					if (type === 'sign-in') {
						console.log(`Sending OTP for sign-in to ${email}: ${otp}`);
					}
				}
			}),
			sveltekitCookies(getRequestEvent)
		] // make sure this is the last plugin in the array
	});

	authCache.set(dbKey, instance);
	return instance;
};
