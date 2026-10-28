import { Hono } from 'hono';
import type { AppEnv } from '../../types';
import { getAuth } from '../../lib/auth';

export const authRouter = new Hono<AppEnv>();

authRouter.all('/*', (c) => {
	const auth = getAuth(c.env, c.req.url);
	return auth.handler(c.req.raw);
});
