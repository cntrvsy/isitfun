import type { User, Session } from 'better-auth/minimal';
import type { DrizzleClient } from '#lib/server/db/index.js';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env;
			cf: CfProperties;
			ctx: ExecutionContext;
		}

		interface Locals {
			user?: User & { role: 'game_developer' | 'admin' };
			session?: Session;
			db: DrizzleClient;
			auth: ReturnType<typeof import('#lib/server/auth.js').getAuth>;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
