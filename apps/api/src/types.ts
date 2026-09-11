import type { D1Database, KVNamespace, R2Bucket, DurableObjectNamespace } from '@cloudflare/workers-types';
import type { User, Session } from 'better-auth/types';

export interface Bindings {
	DB: D1Database;
	ISITFUN_KV: KVNamespace;
	DRIFTER_CONTROL: KVNamespace;
	GAMES_BUCKET: R2Bucket;
	TELEMETRY_BUFFER: DurableObjectNamespace;
	BETTER_AUTH_SECRET?: string;
	BETTER_AUTH_URL?: string;
	TRUSTED_ORIGINS?: string;
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	RESEND_API_KEY?: string;
	RESEND_FROM_EMAIL?: string;
	CREEM_API_KEY?: string;
	CREEM_WEBHOOK_SECRET?: string;
	CREEM_TEST_MODE?: string;
	CREEM_PRODUCT_ID?: string;
	CREEM_PRODUCT_ID_PROJECT_PASS?: string;
	CREEM_PRODUCT_ID_TEAM_SEAT?: string;
}

export type AuthUser = User & {
	role?: 'admin' | 'game_developer' | string;
};

export interface Variables {
	user: AuthUser | null;
	session: Session | null;
}

export type AppEnv = {
	Bindings: Bindings;
	Variables: Variables;
};
