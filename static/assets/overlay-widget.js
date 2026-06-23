(function () {
	// 1. Identify active project from script element context
	const scriptTag = document.currentScript;
	const projectId = scriptTag ? scriptTag.getAttribute('data-project') : null;
	if (!projectId) {
		console.warn('[IsItFun] Telemetry disabled: data-project attribute missing on script tag.');
		return;
	}

	// 2. Resolve or initialize persistent tab-scoped session ID
	let sessionId = sessionStorage.getItem('isitfun_session_id');
	if (!sessionId) {
		sessionId = crypto.randomUUID();
		sessionStorage.setItem('isitfun_session_id', sessionId);
	}

	// 3. Queue and batch telemetry payloads
	let logQueue = [];
	const MAX_QUEUE_SIZE = 10;
	let flushTimeout = null;

	function flushTelemetry() {
		if (logQueue.length === 0) return;

		const payload = {
			projectId,
			sessionId,
			logs: logQueue
		};

		// Reset queue state immediately to avoid race conditions
		logQueue = [];
		if (flushTimeout) {
			clearTimeout(flushTimeout);
			flushTimeout = null;
		}

		const body = JSON.stringify(payload);
		try {
			if (navigator.sendBeacon) {
				navigator.sendBeacon('/api/telemetry', body);
			} else {
				fetch('/api/telemetry', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body,
					keepalive: true
				});
			}
		} catch (e) {
			// Fail silently
		}
	}

	function queueTelemetry(eventName, data) {
		logQueue.push({
			event: eventName,
			data: data || {},
			timestamp: Date.now()
		});

		if (logQueue.length >= MAX_QUEUE_SIZE) {
			flushTelemetry();
		} else if (!flushTimeout) {
			flushTimeout = setTimeout(flushTelemetry, 2000);
		}
	}

	// 4. Expose the universal global window API
	window.IsItFun = {
		log: function (eventName, dataPayload = {}) {
			if (!eventName) return;
			queueTelemetry(eventName, dataPayload);
		}
	};

	// 5. Register visibility and navigation exit event listeners to flush data
	window.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			flushTelemetry();
		}
	});
	window.addEventListener('pagehide', flushTelemetry);
	window.addEventListener('beforeunload', flushTelemetry);
})();
