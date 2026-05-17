import { createAuthClient } from 'better-auth/svelte';
import { emailOTPClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
	baseURL: typeof window !== 'undefined' ? window.location.origin : 'https://isitfun.frstudios.co.ke',
	plugins: [emailOTPClient()]
});
