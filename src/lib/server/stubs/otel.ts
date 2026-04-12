// temporary stubs for opentelemetry

export const trace = {
	getTracer: () => ({
		startSpan: () => ({
			end: () => {},
			setStatus: () => {},
			recordException: () => {},
			setAttribute: () => {},
			setAttributes: () => {},
		}),
		startActiveSpan: (name: string, options: any, callback?: any) => {
			const cb = callback || options;
			return cb({
				end: () => {},
				setStatus: () => {},
				recordException: () => {},
				setAttribute: () => {},
				setAttributes: () => {},
			});
		},
	}),
};

export const context = {
	active: () => ({}),
};

export const propagation = {
	inject: () => {},
	extract: () => ({}),
};

export const setSpan = () => {};



export enum SpanKind {
	INTERNAL = 0,
	SERVER = 1,
	CLIENT = 2,
	PRODUCER = 3,
	CONSUMER = 4,
}

export enum SpanStatusCode {
	UNSET = 0,
	OK = 1,
	ERROR = 2,
}

