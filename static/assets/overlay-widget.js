(function () {
	// 1. Identify active project from script context
	const scriptTag = document.currentScript;
	const projectId = scriptTag ? scriptTag.getAttribute('data-project') : null;
	if (!projectId) {
		console.warn('[IsItFun] Telemetry disabled: data-project attribute missing on script tag.');
		return;
	}

	// 2. Initialize tab-scoped session ID
	let sessionId = sessionStorage.getItem('isitfun_session_id');
	if (!sessionId) {
		sessionId = crypto.randomUUID();
		sessionStorage.setItem('isitfun_session_id', sessionId);
	}

	// 3. Device & Hardware Specs Collector (Non-intrusive, no permissions required)
	function getGpuRenderer() {
		try {
			const canvas = document.createElement('canvas');
			const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
			if (!gl) return null;
			const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
			return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null;
		} catch {
			return null;
		}
	}

	const deviceSpecs = {
		hardwareConcurrency: navigator.hardwareConcurrency || null,
		deviceMemory: navigator.deviceMemory || null,
		screenResolution: `${window.screen.width}x${window.screen.height}`,
		devicePixelRatio: window.devicePixelRatio || 1,
		gpuRenderer: getGpuRenderer()
	};

	// 4. Lightweight FPS & Performance Monitor (requestAnimationFrame)
	let frameCount = 0;
	let lastTime = performance.now();
	let fpsSamples = [];
	let currentAvgFps = 60;
	let minFps = 60;

	function fpsLoop(now) {
		frameCount++;
		const delta = now - lastTime;
		if (delta >= 1000) {
			const fps = Math.round((frameCount * 1000) / delta);
			fpsSamples.push(fps);
			if (fpsSamples.length > 60) fpsSamples.shift(); // Keep last 60 seconds

			const sum = fpsSamples.reduce((a, b) => a + b, 0);
			currentAvgFps = Math.round(sum / fpsSamples.length);
			if (fps < minFps) minFps = fps;

			frameCount = 0;
			lastTime = now;
		}
		requestAnimationFrame(fpsLoop);
	}
	requestAnimationFrame(fpsLoop);

	// 5. Queue, crash tracking, feedback, and batching state
	let logQueue = [];
	let hasCrashed = false;
	let userFeedback = null; // { sentiment: 'fun' | 'neutral' | 'unfun', comment: '' }
	const MAX_QUEUE_SIZE = 15;
	let flushTimeout = null;

	const _originalLog = window.console.log;
	const _originalWarn = window.console.warn;
	const _originalError = window.console.error;

	function formatArgs(args) {
		return args.map(arg => {
			if (typeof arg === 'object' && arg !== null) {
				try {
					return JSON.stringify(arg);
				} catch {
					return String(arg);
				}
			}
			return String(arg);
		}).join(' ');
	}

	function flushTelemetry(isExiting = false) {
		if (logQueue.length === 0 && !isExiting && !userFeedback) return;

		const payload = {
			projectId,
			sessionId,
			logs: logQueue,
			hasCrashed,
			isExiting,
			avgFps: currentAvgFps,
			minFps,
			deviceSpecs,
			feedback: userFeedback
		};

		// Clear log queue immediately
		logQueue = [];
		if (flushTimeout) {
			clearTimeout(flushTimeout);
			flushTimeout = null;
		}

		const body = JSON.stringify(payload);
		try {
			if (isExiting && navigator.sendBeacon) {
				navigator.sendBeacon('/api/telemetry', body);
			} else {
				fetch('/api/telemetry', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body,
					keepalive: true
				});
			}
		} catch {
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
			flushTimeout = setTimeout(() => flushTelemetry(false), 2000);
		}
	}

	// 6. Overwrite Console APIs to capture print statements
	window.console.log = function (...args) {
		_originalLog.apply(window.console, args);
		if (args.length > 1 && (args[0] === '[IsItFun]' || args[0] === '[event]')) {
			const customEventName = String(args[1]);
			let customData = args[2] || {};
			if (typeof customData === 'string') {
				try {
					customData = JSON.parse(customData);
				} catch {
					customData = { detail: customData };
				}
			}
			queueTelemetry(customEventName, customData);
		} else {
			queueTelemetry('console.log', { message: formatArgs(args) });
		}
	};

	window.console.warn = function (...args) {
		_originalWarn.apply(window.console, args);
		queueTelemetry('console.warn', { message: formatArgs(args) });
	};

	window.console.error = function (...args) {
		_originalError.apply(window.console, args);
		queueTelemetry('console.error', { message: formatArgs(args) });
	};

	// 7. Unhandled Exceptions / Crashes
	window.addEventListener('error', function (event) {
		hasCrashed = true;
		queueTelemetry('error', {
			message: event.message,
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno,
			stack: event.error ? event.error.stack : null
		});
	});

	window.addEventListener('unhandledrejection', function (event) {
		hasCrashed = true;
		queueTelemetry('unhandledrejection', {
			reason: String(event.reason),
			stack: event.reason && event.reason.stack ? event.reason.stack : null
		});
	});

	// 8. Universal window API for developers
	window.IsItFun = {
		log: function (eventName, dataPayload = {}) {
			if (!eventName) return;
			queueTelemetry(eventName, dataPayload);
		},
		track: function (eventName, dataPayload = {}) {
			if (!eventName) return;
			queueTelemetry(eventName, dataPayload);
		},
		getFps: function () {
			return currentAvgFps;
		}
	};


	// 9. Qualitative "Is It Fun?" Floating Feedback Widget UI
	function injectFeedbackWidget() {
		if (document.getElementById('isitfun-feedback-root')) return;

		const style = document.createElement('style');
		style.textContent = `
			.isitfun-pill {
				position: fixed;
				bottom: 16px;
				right: 16px;
				z-index: 99999;
				background: linear-gradient(135deg, #7c3aed, #4f46e5);
				color: #ffffff;
				font-family: system-ui, -apple-system, sans-serif;
				font-size: 13px;
				font-weight: 700;
				padding: 10px 16px;
				border-radius: 9999px;
				box-shadow: 0 10px 25px -5px rgba(124, 58, 237, 0.4);
				cursor: pointer;
				border: 1px solid rgba(255, 255, 255, 0.2);
				transition: all 0.2s ease;
				display: flex;
				align-items: center;
				gap: 6px;
			}
			.isitfun-pill:hover {
				transform: translateY(-2px);
				box-shadow: 0 14px 30px -5px rgba(124, 58, 237, 0.6);
			}
			.isitfun-modal-backdrop {
				position: fixed;
				inset: 0;
				z-index: 999999;
				background: rgba(15, 23, 42, 0.8);
				backdrop-filter: blur(8px);
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 16px;
				font-family: system-ui, -apple-system, sans-serif;
			}
			.isitfun-modal-card {
				background: #0f172a;
				border: 1px solid #334155;
				border-radius: 20px;
				padding: 24px;
				width: 100%;
				max-width: 380px;
				color: #f8fafc;
				box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
			}
			.isitfun-sentiment-btn {
				flex: 1;
				background: #1e293b;
				border: 1px solid #334155;
				color: #f8fafc;
				padding: 12px 8px;
				border-radius: 12px;
				font-size: 14px;
				font-weight: 700;
				cursor: pointer;
				transition: all 0.15s ease;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 4px;
			}
			.isitfun-sentiment-btn:hover, .isitfun-sentiment-btn.selected {
				border-color: #8b5cf6;
				background: #2e1065;
				color: #c4b5fd;
			}
		`;
		document.head.appendChild(style);

		const root = document.createElement('div');
		root.id = 'isitfun-feedback-root';
		root.innerHTML = `
			<button id="isitfun-pill-btn" class="isitfun-pill">
				🎮 Was it fun?
			</button>
			<div id="isitfun-modal" class="isitfun-modal-backdrop" style="display: none;">
				<div class="isitfun-modal-card">
					<h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 800;">Was this playtest fun?</h3>
					<p style="margin: 0 0 16px 0; font-size: 12px; color: #94a3b8;">Help the developer level up this game with quick feedback.</p>
					
					<div style="display: flex; gap: 8px; margin-bottom: 16px;">
						<button class="isitfun-sentiment-btn" data-sentiment="fun">
							<span style="font-size: 24px;">😀</span>
							<span>Fun!</span>
						</button>
						<button class="isitfun-sentiment-btn" data-sentiment="neutral">
							<span style="font-size: 24px;">😐</span>
							<span>Okay</span>
						</button>
						<button class="isitfun-sentiment-btn" data-sentiment="unfun">
							<span style="font-size: 24px;">🙁</span>
							<span>Unfun</span>
						</button>
					</div>

					<textarea id="isitfun-comment" placeholder="Optional comments, bugs, or suggestions..." style="width: 100%; box-sizing: border-box; background: #020617; border: 1px solid #334155; border-radius: 12px; padding: 10px; color: #f8fafc; font-size: 13px; min-height: 70px; resize: vertical; margin-bottom: 16px; font-family: inherit;"></textarea>

					<div style="display: flex; justify-content: flex-end; gap: 8px;">
						<button id="isitfun-cancel" style="background: transparent; border: none; color: #94a3b8; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer;">Skip</button>
						<button id="isitfun-submit" style="background: linear-gradient(135deg, #7c3aed, #4f46e5); border: none; color: #fff; padding: 8px 20px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer;">Send Feedback</button>
					</div>
				</div>
			</div>
		`;
		document.body.appendChild(root);

		const pillBtn = document.getElementById('isitfun-pill-btn');
		const modal = document.getElementById('isitfun-modal');
		const cancelBtn = document.getElementById('isitfun-cancel');
		const submitBtn = document.getElementById('isitfun-submit');
		const commentInput = document.getElementById('isitfun-comment');
		const sentimentBtns = root.querySelectorAll('.isitfun-sentiment-btn');

		let selectedSentiment = 'fun';

		pillBtn.addEventListener('click', () => {
			modal.style.display = 'flex';
		});

		cancelBtn.addEventListener('click', () => {
			modal.style.display = 'none';
		});

		sentimentBtns.forEach(btn => {
			btn.addEventListener('click', () => {
				sentimentBtns.forEach(b => b.classList.remove('selected'));
				btn.classList.add('selected');
				selectedSentiment = btn.getAttribute('data-sentiment');
			});
		});

		submitBtn.addEventListener('click', () => {
			const comment = commentInput ? commentInput.value.trim() : '';
			userFeedback = {
				sentiment: selectedSentiment,
				comment
			};

			queueTelemetry('feedback', { sentiment: selectedSentiment, comment });
			flushTelemetry(false);

			modal.style.display = 'none';
			pillBtn.textContent = '✅ Feedback Sent!';
			setTimeout(() => {
				pillBtn.style.display = 'none';
			}, 3000);
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', injectFeedbackWidget);
	} else {
		injectFeedbackWidget();
	}

	// 10. Heartbeat keeping session alive and calculating duration
	setInterval(() => {
		if (document.visibilityState === 'visible') {
			queueTelemetry('heartbeat', {});
		}
	}, 20000);

	// 11. Exit / Navigation Event Listeners
	window.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			flushTelemetry(false);
		}
	});
	window.addEventListener('pagehide', () => flushTelemetry(true));
	window.addEventListener('beforeunload', () => flushTelemetry(true));
})();
