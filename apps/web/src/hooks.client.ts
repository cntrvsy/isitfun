import * as Sentry from '@sentry/sveltekit';
import { handleErrorWithSentry } from '@sentry/sveltekit';

Sentry.init({
	dsn: 'https://52b6021f8a6d08db031cd2689e11301c@o4512364209569792.ingest.de.sentry.io/4512364286443600',
	environment: import.meta.env.DEV ? 'development' : 'production',
	tracesSampleRate: 1.0,
	initialScope: {
		tags: {
			service: 'web-client'
		}
	}
});

export const handleError = handleErrorWithSentry();

