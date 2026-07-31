export function getDemoPingPongHtml(_projectId = 'demo'): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>IsItFun? Demo Playtest - Ping Pong 2D</title>
	<style>
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			background: #090d16;
			color: #f3f4f6;
			font-family: system-ui, -apple-system, sans-serif;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			min-height: 100vh;
			overflow: hidden;
		}
		.container {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 16px;
			max-width: 800px;
			width: 100%;
			padding: 16px;
		}
		header {
			text-align: center;
		}
		h1 {
			font-size: 1.75rem;
			font-weight: 800;
			background: linear-gradient(135deg, #a855f7, #6366f1);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			margin-bottom: 4px;
		}
		p.sub {
			color: #9ca3af;
			font-size: 0.875rem;
		}
		canvas {
			background: #111827;
			border: 2px solid #374151;
			border-radius: 12px;
			box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
			touch-action: none;
		}
		.controls-hint {
			display: flex;
			gap: 16px;
			font-size: 0.8rem;
			color: #6b7280;
		}
		.key {
			background: #1f2937;
			color: #e5e7eb;
			padding: 2px 6px;
			border-radius: 4px;
			border: 1px solid #4b5563;
		}
	</style>
</head>
<body>
	<div class="container">
		<header>
			<h1>🏓 IsItFun? Demo Playtest - Ping Pong</h1>
			<p class="sub">Play the game below. Try scoring points and leaving feedback via the bottom-right pill!</p>
		</header>

		<canvas id="gameCanvas" width="700" height="400"></canvas>

		<div class="controls-hint">
			<span><span class="key">W</span> / <span class="key">S</span> or <span class="key">↑</span> / <span class="key">↓</span> - Move Paddle</span>
			<span><span class="key">Mouse / Touch</span> - Drag Paddle</span>
		</div>
	</div>

	<script>
		(function () {
			const canvas = document.getElementById('gameCanvas');
			const ctx = canvas.getContext('2d');

			// Web Audio API Synthesizer for sound effects
			let audioCtx = null;
			function playBeep(freq = 440, duration = 0.08, type = 'sine') {
				try {
					if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
					if (audioCtx.state === 'suspended') audioCtx.resume();
					const osc = audioCtx.createOscillator();
					const gain = audioCtx.createGain();
					osc.type = type;
					osc.frequency.value = freq;
					gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
					gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
					osc.connect(gain);
					gain.connect(audioCtx.destination);
					osc.start();
					osc.stop(audioCtx.currentTime + duration);
				} catch {
					// Ignore audio errors
				}
			}

			// Game state
			const paddleWidth = 12;
			const paddleHeight = 80;

			let playerY = (canvas.height - paddleHeight) / 2;
			let aiY = (canvas.height - paddleHeight) / 2;
			let playerSpeed = 0;
			const paddleSpeed = 6;

			let ballX = canvas.width / 2;
			let ballY = canvas.height / 2;
			let ballRadius = 8;
			let ballSpeedX = 5;
			let ballSpeedY = 3;
			let rallyCount = 0;

			let playerScore = 0;
			let aiScore = 0;

			// Keyboard event listeners
			window.addEventListener('keydown', (e) => {
				if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') playerSpeed = -paddleSpeed;
				if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') playerSpeed = paddleSpeed;
			});

			window.addEventListener('keyup', (e) => {
				if (['w', 'W', 'ArrowUp', 's', 'S', 'ArrowDown'].includes(e.key)) playerSpeed = 0;
			});

			// Mouse / Touch drag listener
			canvas.addEventListener('pointermove', (e) => {
				const rect = canvas.getBoundingClientRect();
				const relativeY = e.clientY - rect.top;
				playerY = Math.max(0, Math.min(canvas.height - paddleHeight, relativeY - paddleHeight / 2));
			});

			function resetBall(direction = 1) {
				ballX = canvas.width / 2;
				ballY = canvas.height / 2;
				ballSpeedX = 5 * direction;
				ballSpeedY = (Math.random() - 0.5) * 6;
				rallyCount = 0;
			}

			let gameStartTime = Date.now();
			let hasEmittedInactivity = false;
			let isGameOver = false;

			function update() {
				if (isGameOver) return;

				// Inactivity / Lull Check: if 45s passed and player score is 0
				if (!hasEmittedInactivity && Date.now() - gameStartTime > 45000 && playerScore === 0) {
					hasEmittedInactivity = true;
					if (window.IsItFun && window.IsItFun.log) {
						window.IsItFun.log('inactivity_warning', {
							timeElapsedSec: Math.round((Date.now() - gameStartTime) / 1000),
							playerScore,
							aiScore,
							message: 'Player has not scored after 45 seconds of play'
						});
					}
					console.warn('[IsItFun]', 'game_lull', JSON.stringify({ reason: 'slow_player_start', durationSec: 45 }));
				}

				// Move Player Paddle
				playerY += playerSpeed;
				playerY = Math.max(0, Math.min(canvas.height - paddleHeight, playerY));

				// Move AI Paddle with slight latency for fun gameplay
				const aiTarget = ballY - paddleHeight / 2;
				aiY += (aiTarget - aiY) * 0.08;
				aiY = Math.max(0, Math.min(canvas.height - paddleHeight, aiY));

				// Move Ball
				ballX += ballSpeedX;
				ballY += ballSpeedY;

				// Top/Bottom Wall Bounce
				if (ballY - ballRadius <= 0 || ballY + ballRadius >= canvas.height) {
					ballSpeedY *= -1;
					playBeep(320, 0.05, 'square');
				}

				// Player Paddle Collision
				if (
					ballX - ballRadius <= 20 + paddleWidth &&
					ballY >= playerY &&
					ballY <= playerY + paddleHeight
				) {
					ballSpeedX = Math.abs(ballSpeedX) * 1.05; // Slightly speed up
					const hitOffset = (ballY - (playerY + paddleHeight / 2)) / (paddleHeight / 2);
					ballSpeedY = hitOffset * 6;
					rallyCount++;
					playBeep(520, 0.08, 'sine');

					// Emit custom telemetry log
					if (window.IsItFun && window.IsItFun.track) {
						window.IsItFun.track('paddle_hit', { rallyCount, speed: Math.round(Math.abs(ballSpeedX)), paddle: 'player' });
					} else {
						console.log('[IsItFun]', 'paddle_hit', JSON.stringify({ rallyCount, paddle: 'player' }));
					}

					// Epic Rally Trigger (5+ hits)
					if (rallyCount === 5) {
						if (window.IsItFun && window.IsItFun.log) {
							window.IsItFun.log('epic_rally', { rallyCount, ballSpeed: Math.round(Math.abs(ballSpeedX)) });
						}
						console.log('[IsItFun]', 'epic_rally', JSON.stringify({ rallyCount }));
					}
				}

				// AI Paddle Collision
				if (
					ballX + ballRadius >= canvas.width - 20 - paddleWidth &&
					ballY >= aiY &&
					ballY <= aiY + paddleHeight
				) {
					ballSpeedX = -Math.abs(ballSpeedX) * 1.05;
					const hitOffset = (ballY - (aiY + paddleHeight / 2)) / (paddleHeight / 2);
					ballSpeedY = hitOffset * 6;
					rallyCount++;
					playBeep(480, 0.08, 'sine');
				}

				// Scoring
				if (ballX < 0) {
					aiScore++;
					playBeep(200, 0.2, 'sawtooth');
					if (window.IsItFun && window.IsItFun.track) {
						window.IsItFun.track('opponent_score', { scorer: 'ai', playerScore, aiScore });
					}
					console.warn('[IsItFun]', 'opponent_score', JSON.stringify({ scorer: 'ai', playerScore, aiScore }));

					if (aiScore >= 5) {
						isGameOver = true;
						if (window.IsItFun && window.IsItFun.log) {
							window.IsItFun.log('game_over', { winner: 'ai', finalScore: playerScore + '-' + aiScore, playDurationSec: Math.round((Date.now() - gameStartTime) / 1000) });
						}
						console.error('[IsItFun]', 'game_over', JSON.stringify({ winner: 'ai', finalScore: playerScore + '-' + aiScore }));
					} else {
						resetBall(1);
					}
				} else if (ballX > canvas.width) {
					playerScore++;
					playBeep(750, 0.25, 'triangle');
					if (window.IsItFun && window.IsItFun.track) {
						window.IsItFun.track('point_scored', { scorer: 'player', playerScore, aiScore });
					} else {
						console.log('[IsItFun]', 'point_scored', JSON.stringify({ scorer: 'player', playerScore, aiScore }));
					}

					if (playerScore >= 5) {
						isGameOver = true;
						if (window.IsItFun && window.IsItFun.log) {
							window.IsItFun.log('game_over', { winner: 'player', finalScore: playerScore + '-' + aiScore, playDurationSec: Math.round((Date.now() - gameStartTime) / 1000) });
						}
						console.log('[IsItFun]', 'game_over', JSON.stringify({ winner: 'player', finalScore: playerScore + '-' + aiScore }));
					} else {
						resetBall(-1);
					}
				}
			}

			function draw() {
				// Clear background
				ctx.fillStyle = '#111827';
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				// Draw net line
				ctx.setLineDash([8, 8]);
				ctx.strokeStyle = '#374151';
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(canvas.width / 2, 0);
				ctx.lineTo(canvas.width / 2, canvas.height);
				ctx.stroke();
				ctx.setLineDash([]);

				// Draw Scores
				ctx.fillStyle = '#6b7280';
				ctx.font = '700 36px system-ui, sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText(playerScore, canvas.width / 2 - 60, 50);
				ctx.fillText(aiScore, canvas.width / 2 + 60, 50);

				// Draw Player Paddle
				ctx.fillStyle = '#a855f7';
				ctx.fillRect(20, playerY, paddleWidth, paddleHeight);

				// Draw AI Paddle
				ctx.fillStyle = '#6366f1';
				ctx.fillRect(canvas.width - 20 - paddleWidth, aiY, paddleWidth, paddleHeight);

				// Draw Ball
				ctx.fillStyle = '#facc15';
				ctx.beginPath();
				ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
				ctx.fill();
			}

			function gameLoop() {
				update();
				draw();
				requestAnimationFrame(gameLoop);
			}

			requestAnimationFrame(gameLoop);
		})();
	</script>
</body>
</html>`;
}
