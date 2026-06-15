(function () {
	// 1. Identify active playtest project from script element context
	const scriptTag = document.currentScript;
	const projectId = scriptTag ? scriptTag.getAttribute('data-project') : null;
	if (!projectId) {
		console.warn('[IsItFun] Telemetry disabled: data-project attribute missing on script tag.');
		return;
	}

	const tier = scriptTag ? (scriptTag.getAttribute('data-tier') || 'free') : 'free';

	// 2. Resolve or initialize persistent tab-scoped session ID
	let sessionId = sessionStorage.getItem('isitfun_session_id');
	if (!sessionId) {
		sessionId = crypto.randomUUID();
		sessionStorage.setItem('isitfun_session_id', sessionId);
	}

	// Gather browser information
	const browserInfo = {
		userAgent: navigator.userAgent,
		screenSize: `${window.innerWidth}x${window.innerHeight}`,
		devicePixelRatio: window.devicePixelRatio,
		language: navigator.language
	};

	// 3. Dispatch telemetry payloads to edge API with batching
	let logQueue = [];
	const MAX_QUEUE_SIZE = 15;

	function flushTelemetry() {
		if (logQueue.length === 0) return;

		const url = '/api/telemetry';
		const payload = {
			projectId,
			sessionId,
			browserInfo: JSON.stringify(browserInfo),
			logs: logQueue
		};
		const body = JSON.stringify(payload);

		try {
			if (navigator.sendBeacon) {
				navigator.sendBeacon(url, body);
			} else {
				fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body,
					keepalive: true
				});
			}
		} catch {
			// Fail silently
		}
		logQueue = [];
	}

	function queueTelemetry(logType, payload, flushImmediately = false) {
		logQueue.push({
			logType,
			payload,
			timestamp: new Date().toISOString()
		});

		if (flushImmediately || logQueue.length >= MAX_QUEUE_SIZE) {
			flushTelemetry();
		}
	}

	// 4. Hook window error handlers and console log output
	if (tier !== 'free') {
		window.addEventListener('error', function (event) {
			queueTelemetry('error', {
				message: event.message,
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
				stack: event.error ? event.error.stack : null
			});
		});

		window.addEventListener('unhandledrejection', function (event) {
			queueTelemetry('error', {
				message: 'Unhandled Promise Rejection',
				reason: event.reason ? String(event.reason.stack || event.reason) : 'Unknown'
			});
		});

		// Preserve and hook into console methods
		const originalConsoleLog = console.log;
		const originalConsoleWarn = console.warn;
		const originalConsoleError = console.error;

		console.log = function (...args) {
			originalConsoleLog.apply(console, args);
			queueTelemetry('log', { level: 'log', message: args.map(String).join(' ') });
		};

		console.warn = function (...args) {
			originalConsoleWarn.apply(console, args);
			queueTelemetry('log', { level: 'warn', message: args.map(String).join(' ') });
		};

		console.error = function (...args) {
			originalConsoleError.apply(console, args);
			queueTelemetry('log', { level: 'error', message: args.map(String).join(' ') });
		};
	}

	// 5. Active Heartbeat pulse (fires every 10 seconds to aggregate game time)
	if (tier !== 'free') {
		setInterval(() => {
			queueTelemetry('heartbeat', { pulse: true });
		}, 10000);
	}

	// Start initial session heartbeat immediately
	queueTelemetry('heartbeat', { init: true });

	// Register window visibility change and pagehide events to flush buffered telemetry
	window.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden' && logQueue.length > 0) {
			flushTelemetry();
		}
	});

	window.addEventListener('pagehide', () => {
		if (logQueue.length > 0) {
			flushTelemetry();
		}
	});

	window.addEventListener('beforeunload', () => {
		queueTelemetry('unload', { exit: true }, true);
	});

	window.IsItFun = {
		log: function (logType, payload) {
			if (!logType) return;
			// Pass false to buffer standard custom events, allowing maximum queue efficiency
			queueTelemetry(logType, payload || {});
		},
		track: function (eventName, properties) {
			if (!eventName) return;
			window.dispatchEvent(new CustomEvent('isitfun:telemetry', {
				detail: { eventName, properties: properties || {} }
			}));
		}
	};

	window.addEventListener('isitfun:telemetry', function (event) {
		const detail = event.detail || {};
		queueTelemetry('gameplay_event', {
			eventName: detail.eventName,
			properties: detail.properties || {}
		});
	});

	// 6. Build and inject Floating Feedback UI
	const styleElement = document.createElement('style');
	styleElement.innerHTML = `
		#isitfun-root {
			font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			color: #f1f5f9;
			direction: ltr;
		}

		/* Floating Trigger Button */
		.isitfun-trigger {
			position: fixed;
			bottom: 24px;
			right: 24px;
			z-index: 999990;
			background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
			border: none;
			border-radius: 9999px;
			padding: 12px 20px;
			font-size: 14px;
			font-weight: 700;
			color: #ffffff;
			cursor: pointer;
			display: flex;
			items-center: center;
			gap: 8px;
			box-shadow: 0 10px 25px -5px rgba(139, 92, 246, 0.5);
			transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
		}

		.isitfun-trigger:hover {
			transform: translateY(-2px) scale(1.03);
			box-shadow: 0 15px 30px -5px rgba(139, 92, 246, 0.7);
		}

		.isitfun-trigger svg {
			width: 18px;
			height: 18px;
			fill: currentColor;
		}

		/* Feedback Side Drawer Panel */
		.isitfun-drawer {
			position: fixed;
			top: 0;
			right: 0;
			width: 380px;
			max-width: 100%;
			height: 100%;
			background: rgba(15, 23, 42, 0.93);
			backdrop-filter: blur(16px);
			-webkit-backdrop-filter: blur(16px);
			border-left: 1px solid rgba(255, 255, 255, 0.08);
			box-shadow: -20px 0 50px rgba(0, 0, 0, 0.5);
			z-index: 999995;
			display: flex;
			flex-direction: column;
			transform: translateX(100%);
			transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
		}

		.isitfun-drawer.open {
			transform: translateX(0);
		}

		.isitfun-header {
			padding: 24px;
			border-b: 1px solid rgba(255, 255, 255, 0.06);
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.isitfun-header h3 {
			margin: 0;
			font-size: 20px;
			font-weight: 800;
			background: linear-gradient(to right, #a78bfa, #818cf8);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
		}

		.isitfun-close-btn {
			background: transparent;
			border: none;
			color: #94a3b8;
			font-size: 20px;
			cursor: pointer;
			padding: 4px;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: color 0.2s;
		}

		.isitfun-close-btn:hover {
			color: #ffffff;
		}

		.isitfun-body {
			padding: 24px;
			flex-grow: 1;
			overflow-y: auto;
			display: flex;
			flex-direction: column;
			gap: 20px;
		}

		.isitfun-label {
			font-size: 11px;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: #94a3b8;
			margin-bottom: 8px;
			display: block;
		}

		/* Rating Slider */
		.isitfun-emoji-bar {
			text-align: center;
			font-size: 40px;
			height: 55px;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: transform 0.2s ease;
		}

		.isitfun-slider-container {
			background: rgba(255, 255, 255, 0.03);
			border: 1px solid rgba(255, 255, 255, 0.05);
			border-radius: 16px;
			padding: 16px;
			text-align: center;
		}

		.isitfun-slider {
			width: 100%;
			margin: 12px 0;
			-webkit-appearance: none;
			background: rgba(255, 255, 255, 0.1);
			height: 6px;
			border-radius: 9999px;
			outline: none;
		}

		.isitfun-slider::-webkit-slider-thumb {
			-webkit-appearance: none;
			width: 20px;
			height: 20px;
			border-radius: 50%;
			background: #8b5cf6;
			cursor: pointer;
			box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
			transition: background 0.2s;
		}

		.isitfun-slider-desc {
			font-size: 12px;
			font-weight: 700;
			color: #c084fc;
		}

		/* Selector Pill Buttons */
		.isitfun-pills {
			display: flex;
			gap: 8px;
		}

		.isitfun-pill {
			flex-grow: 1;
			background: rgba(255, 255, 255, 0.03);
			border: 1px solid rgba(255, 255, 255, 0.06);
			border-radius: 8px;
			padding: 8px 12px;
			font-size: 12px;
			font-weight: 600;
			color: #94a3b8;
			cursor: pointer;
			text-align: center;
			transition: all 0.2s;
		}

		.isitfun-pill.active {
			background: rgba(139, 92, 246, 0.15);
			border-color: #8b5cf6;
			color: #c084fc;
		}

		/* Textarea input */
		.isitfun-textarea {
			background: rgba(0, 0, 0, 0.4);
			border: 1px solid rgba(255, 255, 255, 0.06);
			border-radius: 12px;
			padding: 12px;
			color: #f8fafc;
			font-size: 13px;
			line-height: 1.5;
			width: 100%;
			height: 100px;
			resize: none;
			box-sizing: border-box;
			outline: none;
			transition: border-color 0.2s;
		}

		.isitfun-textarea:focus {
			border-color: #8b5cf6;
		}

		/* Submit Button */
		.isitfun-submit-btn {
			background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
			border: none;
			border-radius: 12px;
			padding: 14px;
			font-weight: 700;
			font-size: 14px;
			color: #ffffff;
			cursor: pointer;
			transition: all 0.2s;
			box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.isitfun-submit-btn:hover {
			transform: translateY(-1px);
			box-shadow: 0 6px 15px rgba(139, 92, 246, 0.3);
		}

		/* Animations & Screen states */
		.isitfun-success-screen {
			text-align: center;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 16px;
			height: 250px;
		}

		.isitfun-success-check {
			width: 60px;
			height: 60px;
			border-radius: 50%;
			background: rgba(16, 185, 129, 0.1);
			color: #10b981;
			font-size: 32px;
			display: flex;
			align-items: center;
			justify-content: center;
			animation: popin 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
		}

		@keyframes popin {
			0% { transform: scale(0); opacity: 0; }
			100% { transform: scale(1); opacity: 1; }
		}
	`;

	// Append Styles to head
	document.head.appendChild(styleElement);

	// Construct Widget Elements
	const widgetRoot = document.createElement('div');
	widgetRoot.id = 'isitfun-root';
	widgetRoot.innerHTML = `
		<button class="isitfun-trigger" id="isitfun-trigger-btn" aria-label="Provide playtest feedback">
			<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
			<span>Feedback</span>
		</button>

		<div class="isitfun-drawer" id="isitfun-drawer-panel">
			<div class="isitfun-header">
				<h3>Is It Fun?</h3>
				<button class="isitfun-close-btn" id="isitfun-close-btn" aria-label="Close panel">✕</button>
			</div>

			<div class="isitfun-body" id="isitfun-drawer-body">
				<!-- Rating Section -->
				<div>
					<span class="isitfun-label">Rate Your Experience</span>
					<div class="isitfun-slider-container">
						<div class="isitfun-emoji-bar" id="isitfun-emoji-display">😐</div>
						<input type="range" min="1" max="5" value="3" class="isitfun-slider" id="isitfun-rating-slider" />
						<div class="isitfun-slider-desc" id="isitfun-rating-desc">Neutral / Okay</div>
					</div>
				</div>

				<!-- Type Selector Section -->
				<div>
					<span class="isitfun-label">Feedback Category</span>
					<div class="isitfun-pills">
						<button type="button" class="isitfun-pill active" data-type="comment">💬 Comment</button>
						<button type="button" class="isitfun-pill" data-type="suggestion">💡 Suggestion</button>
						<button type="button" class="isitfun-pill" data-type="bug_report">⚠️ Bug</button>
					</div>
				</div>

				<!-- Comment Input Section -->
				<div>
					<span class="isitfun-label">Details / Notes</span>
					<textarea class="isitfun-textarea" id="isitfun-feedback-text" placeholder="Tell the developer what you think! Did you get stuck? Was a jump satisfying?"></textarea>
				</div>

				<!-- Action Submit -->
				<button class="isitfun-submit-btn" id="isitfun-submit-btn">
					Submit Feedback
				</button>
			</div>
		</div>
	`;

	document.body.appendChild(widgetRoot);

	// 7. Interactive Bindings & Mechanics
	const triggerBtn = document.getElementById('isitfun-trigger-btn');
	const closeBtn = document.getElementById('isitfun-close-btn');
	const drawerPanel = document.getElementById('isitfun-drawer-panel');
	const drawerBody = document.getElementById('isitfun-drawer-body');
	const ratingSlider = document.getElementById('isitfun-rating-slider');
	const emojiDisplay = document.getElementById('isitfun-emoji-display');
	const ratingDesc = document.getElementById('isitfun-rating-desc');
	const feedbackText = document.getElementById('isitfun-feedback-text');
	const submitBtn = document.getElementById('isitfun-submit-btn');
	const pills = document.querySelectorAll('.isitfun-pill');

	let selectedType = 'comment';

	const emojiMap = {
		1: { emoji: '🤬', label: 'Frustrated / Broken' },
		2: { emoji: '🥱', label: 'Boring / Slow' },
		3: { emoji: '😐', label: 'Neutral / Okay' },
		4: { emoji: '😊', label: 'Good / Fun!' },
		5: { emoji: '🤯', label: 'AMAZING! Pure Joy!' }
	};

	// Open/Close Drawer Toggle
	triggerBtn.addEventListener('click', () => {
		drawerPanel.classList.add('open');
	});

	closeBtn.addEventListener('click', () => {
		drawerPanel.classList.remove('open');
	});

	// Handle Emoji & Rating changes
	ratingSlider.addEventListener('input', (event) => {
		const val = event.target.value;
		emojiDisplay.textContent = emojiMap[val].emoji;
		ratingDesc.textContent = emojiMap[val].label;
		
		// Micro-animation squeeze scale on change
		emojiDisplay.style.transform = 'scale(1.1)';
		setTimeout(() => {
			emojiDisplay.style.transform = 'scale(1.0)';
		}, 150);
	});

	// Pill feedback type selector
	pills.forEach((pill) => {
		pill.addEventListener('click', () => {
			pills.forEach((p) => p.classList.remove('active'));
			pill.classList.add('active');
			selectedType = pill.getAttribute('data-type');
		});
	});

	// Submit Feedbacks to server
	submitBtn.addEventListener('click', async () => {
		const comment = feedbackText.value.trim();
		const score = parseInt(ratingSlider.value, 10);

		if (!comment) {
			feedbackText.style.borderColor = '#ef4444';
			setTimeout(() => {
				feedbackText.style.borderColor = 'rgba(255, 255, 255, 0.06)';
			}, 2000);
			return;
		}

		submitBtn.disabled = true;
		submitBtn.textContent = 'Sending...';

		// Construct payload
		const reportPayload = {
			rating: score,
			category: selectedType,
			feedback: comment,
			timestamp: new Date().toISOString()
		};

		// 1. Submit as a direct bug_report/telemetry log entry and flush immediately
		queueTelemetry('bug_report', reportPayload, true);

		// 2. Transmute UI to success screen state
		const originalBodyHTML = drawerBody.innerHTML;
		drawerBody.innerHTML = `
			<div class="isitfun-success-screen animate-in fade-in zoom-in-95 duration-300">
				<div class="isitfun-success-check">✓</div>
				<h4 style="margin: 0; font-size: 18px; font-weight: 800; color: #10b981;">Feedback Sent!</h4>
				<p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6; max-width: 250px; margin: 0 auto;">
					Thank you! Your ratings and gameplay diagnostics have been securely delivered to the developer.
				</p>
				<button class="isitfun-pill" id="isitfun-reset-btn" style="margin-top: 16px; border-color: rgba(255, 255, 255, 0.1);">
					Send another report
				</button>
			</div>
		`;

		// Close panel after 3 seconds
		const autoCloseTimer = setTimeout(() => {
			drawerPanel.classList.remove('open');
		}, 3000);

		// Rebind "send another report" action if they wish
		document.getElementById('isitfun-reset-btn').addEventListener('click', () => {
			clearTimeout(autoCloseTimer);
			drawerBody.innerHTML = originalBodyHTML;
			// Rebind listeners on new HTML nodes
			const newRatingSlider = document.getElementById('isitfun-rating-slider');
			const newEmojiDisplay = document.getElementById('isitfun-emoji-display');
			const newRatingDesc = document.getElementById('isitfun-rating-desc');
			const newSubmitBtn = document.getElementById('isitfun-submit-btn');
			const newPills = document.querySelectorAll('.isitfun-pill');

			newRatingSlider.addEventListener('input', (event) => {
				const val = event.target.value;
				newEmojiDisplay.textContent = emojiMap[val].emoji;
				newRatingDesc.textContent = emojiMap[val].label;
			});

			newPills.forEach((pill) => {
				pill.addEventListener('click', () => {
					newPills.forEach((p) => p.classList.remove('active'));
					pill.classList.add('active');
					selectedType = pill.getAttribute('data-type');
				});
			});

			// Recurse sub-bindings
			newSubmitBtn.addEventListener('click', () => {
				// Triggers original handler closure or re-entry
				submitBtn.click(); 
			});
		});
	});
})();
