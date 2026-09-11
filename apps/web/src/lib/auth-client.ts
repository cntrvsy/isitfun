import { createAuthClient } from 'better-auth/svelte';
import { emailOTPClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
	baseURL: typeof window !== 'undefined' ? '/v1/auth' : 'http://localhost:8787/v1/auth',
	plugins: [emailOTPClient()]
});
