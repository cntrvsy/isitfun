import type { RequestHandler } from './$types';

export const fallback: RequestHandler = async ({ request, locals }) => {
	return locals.auth.handler(request);
};
