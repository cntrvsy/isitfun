import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { emailOTP } from 'better-auth/plugins';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import type { DrizzleClient } from '$lib/server/db';

export const getAuth = (db: DrizzleClient) =>
	betterAuth({
		baseURL: env.ORIGIN || '',
		secret: env.BETTER_AUTH_SECRET || '',
		database: drizzleAdapter(db, { provider: 'sqlite' }),
		trustedOrigins: env.TRUSTED_ORIGINS?.split(',') || [],
		emailAndPassword: { enabled: false },
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
		plugins: [
			emailOTP({
				async sendVerificationOTP({ email, otp, type }) {
					if (type === 'sign-in') {
						// For now, log to console. We'll add Mailgun later if needed.
						console.log(`Sending OTP for sign-in to ${email}: ${otp}`);
					}
				}
			}),
			sveltekitCookies(getRequestEvent)
		] // make sure this is the last plugin in the array
	});

// Used exclusively for the `auth:schema` CLI command
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
export const auth = process.env.npm_lifecycle_event === 'auth:schema' 
    ? getAuth(require('drizzle-orm/better-sqlite3').drizzle(new (require('better-sqlite3'))(':memory:'))) 
    : (null as any);
