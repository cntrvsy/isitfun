import type { User, Session } from 'better-auth';
import type { DrizzleClient } from '@isitfun/db';
import type { ApiClient } from '#lib/api/client.js';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env & {
				API: Fetcher;
			};
			cf: CfProperties;
			ctx: ExecutionContext;
		}

		interface Locals {
			user: (User & { role: 'game_developer' | 'admin' }) | null;
			session: Session | null;
			api: ApiClient;
			db: DrizzleClient;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			auth?: any;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module '$env/dynamic/private' {
	export const env: Record<string, string | undefined>;
}

export {};
