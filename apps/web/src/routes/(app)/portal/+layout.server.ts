import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isConnectedToProduction } from '#lib/api/config.js';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	if (!locals.session || !locals.user) {
		redirect(302, '/auth');
	}

	return {
		user: locals.user,
		isLiveConnected: isConnectedToProduction(platform)
	};
};
