import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createD1Client, schema } from '@isitfun/db';
import type { Bindings } from '../types';
import { sendPasswordResetEmail, sendVerificationEmail } from './email';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authCache = new WeakMap<object, any>();

export function getAuth(env: Bindings, requestURL?: string) {
	const dbKey = env.DB as object;
	if (authCache.has(dbKey)) {
		return authCache.get(dbKey);
	}

	const db = createD1Client(env.DB);
	const baseURL =
		env.BETTER_AUTH_URL ||
		(requestURL ? new URL(requestURL).origin : 'https://isitfun.frstudios.co.ke');

	const trustedOrigins = [
		'https://isitfun.frstudios.co.ke',
		'http://localhost:5173',
		'http://localhost:8787',
		baseURL,
		...(env.TRUSTED_ORIGINS?.split(',') || [])
	]
		.map((o) => o.trim())
		.filter(Boolean);

	// Dynamically configure social providers if keys are present
	const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
	if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
		socialProviders.github = {
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET
		};
	}
	if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
		socialProviders.google = {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET
		};
	}

	const instance = betterAuth({
		basePath: '/v1/auth',
		baseURL,
		secret: env.BETTER_AUTH_SECRET || 'dev-secret-change-in-production',
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema: {
				user: schema.user,
				session: schema.session,
				account: schema.account,
				verification: schema.verification
			}
		}),
		trustedOrigins,
		emailAndPassword: {
			enabled: true,
			async sendResetPassword({ user, url }) {
				await sendPasswordResetEmail({
					apiKey: env.RESEND_API_KEY,
					from: env.RESEND_FROM_EMAIL,
					to: user.email,
					url
				});
			}
		},
		emailVerification: {
			sendVerificationEmail: async ({ user, url }) => {
				await sendVerificationEmail({
					apiKey: env.RESEND_API_KEY,
					from: env.RESEND_FROM_EMAIL,
					to: user.email,
					url
				});
			}
		},
		socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
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
				path: '/',
				sameSite: 'lax',
				secure: true
			}
		}
	});

	authCache.set(dbKey, instance);
	return instance;
}

export type Auth = ReturnType<typeof getAuth>;
