import { createAuthClient } from 'better-auth/svelte';
import { emailOTPClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
	baseURL: typeof window !== 'undefined' ? undefined : 'https://isitfun.frstudios.co.ke/api/auth',
	plugins: [emailOTPClient()]
});
