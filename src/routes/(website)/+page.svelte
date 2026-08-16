<script lang="ts">
	import Footer from '#lib/components/Footer.svelte';
	import { resolve } from '$app/paths';
	import { Play, ArrowUpRight, Terminal, Shield, Activity, Layers } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Is It Fun? — Level Up Your Game Playtests</title>
	<meta
		name="description"
		content="Stop guessing if your core loop is satisfying. Drop your game build, gather player feedback, and see if your game is actually fun!"
	/>
</svelte:head>

<div class="flex min-h-screen flex-col bg-transparent text-slate-800 selection:bg-purple-300">
	<!-- Hero Section -->
	<div class="relative border-b border-purple-200/40 px-6 py-16 md:py-28 lg:px-16">
		<!-- Background decorative subtle coordinates -->
		<div
			class="pointer-events-none absolute top-4 right-6 font-mono text-[9px] tracking-widest text-purple-400/40 uppercase"
		>
			[ Latency: Edge-Native / Location: Global ]
		</div>

		<div class="mx-auto grid max-w-7xl grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
			<!-- Hero Left: Typography & Messaging -->
			<div class="flex flex-col justify-center lg:col-span-7">
				<div
					class="mb-6 inline-flex items-center gap-2 font-mono text-xs font-bold tracking-widest text-purple-700 uppercase"
				>
					<span class="h-2 w-2 animate-pulse rounded-full bg-purple-600"></span>
					Playtest Observability Engine
				</div>

				<h1
					class="mb-6 font-mono text-5xl leading-[0.9] font-black tracking-tighter text-slate-900 md:text-7xl lg:text-8xl"
				>
					IS IT<br />
					<span
						class="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent"
						>FUN?</span
					>
				</h1>

				<p class="mb-10 max-w-xl text-lg leading-relaxed font-medium text-slate-600">
					Stop guessing if your core loop is satisfying. Toss your WebGL/HTML5 builds onto our edge,
					hook up playtesters, and capture raw player satisfaction metrics before coding the wrong
					game.
				</p>

				<div class="flex flex-col gap-4 sm:flex-row">
					<a
						href={resolve('/(app)/auth')}
						class="group inline-flex items-center justify-center gap-2 border border-slate-900 bg-slate-900 px-8 py-4 font-mono text-xs font-bold tracking-wider text-white uppercase transition-all duration-150 hover:bg-transparent hover:text-slate-900"
					>
						Deploy A Playtest
						<Play
							class="h-3 w-3 fill-current transition-transform duration-150 group-hover:translate-x-0.5"
						/>
					</a>
					<a
						href="#features"
						class="group inline-flex items-center justify-center gap-2 border border-purple-200/60 bg-white/40 px-8 py-4 font-mono text-xs font-bold tracking-wider text-slate-800 uppercase transition-all duration-150 hover:border-slate-900 hover:bg-transparent"
					>
						How it works
						<ArrowUpRight
							class="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
						/>
					</a>
				</div>
			</div>

			<!-- Hero Right: Artsy Blueprint Mockup -->
			<div class="flex items-center justify-center lg:col-span-5">
				<div
					class="relative w-full max-w-md overflow-hidden border border-purple-200/50 bg-white/40 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-purple-300"
				>
					<!-- Fine design studio grid markers -->
					<div class="absolute top-0 left-0 h-3 w-3 border-t border-l border-purple-300"></div>
					<div class="absolute top-0 right-0 h-3 w-3 border-t border-r border-purple-300"></div>
					<div class="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-purple-300"></div>
					<div class="absolute right-0 bottom-0 h-3 w-3 border-r border-b border-purple-300"></div>

					<div
						class="mb-4 flex items-center justify-between border-b border-purple-100 pb-3 font-mono text-[10px] tracking-wider text-slate-400"
					>
						<span>[ GAME_VIEWPORTER ]</span>
						<span>BUILD: v1.0.4_PROTOTYPE</span>
					</div>

					<!-- Simulated running game area -->
					<div
						class="relative flex aspect-video w-full flex-col justify-between overflow-hidden bg-slate-900 p-4"
					>
						<!-- Custom abstract game-like lines representing a running game -->
						<div
							class="absolute inset-0 bg-[radial-gradient(#8b5cf6_1px,transparent_1px)] [background-size:16px_16px] opacity-15"
						></div>

						<!-- Vector drawing to look like an retro vector indie game -->
						<svg
							class="absolute inset-0 h-full w-full fill-none stroke-purple-500/30"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path d="M 0,100 Q 150,150 250,50 T 500,100" stroke-width="2" />
							<circle cx="250" cy="50" r="8" class="animate-bounce" />
							<rect x="50" y="80" width="30" height="40" stroke-dasharray="4" />
						</svg>

						<div
							class="z-10 flex items-center justify-between font-mono text-[9px] text-purple-400"
						>
							<span>SCORE: 004810</span>
							<span>FPS: 60.0</span>
						</div>

						<!-- Injected feedback widget mockup -->
						<div
							class="z-10 max-w-[180px] self-end rounded-lg border border-purple-500/20 bg-slate-950/90 p-3 shadow-lg"
						>
							<div class="mb-1 flex items-center justify-between border-b border-slate-800 pb-1">
								<span class="font-mono text-[8px] font-bold text-purple-400 uppercase"
									>Feedback Hub</span
								>
								<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
							</div>
							<p class="mb-2 text-[8px] leading-tight text-slate-400">
								Is the jumps mechanics fun?
							</p>
							<div class="mb-2 grid grid-cols-3 gap-1">
								<button
									class="rounded bg-slate-800 py-0.5 font-mono text-[8px] text-slate-300 hover:bg-purple-600 hover:text-white"
									>Yes</button
								>
								<button
									class="rounded bg-slate-800 py-0.5 font-mono text-[8px] text-slate-300 hover:bg-purple-600 hover:text-white"
									>Meh</button
								>
								<button
									class="rounded bg-slate-800 py-0.5 font-mono text-[8px] text-slate-300 hover:bg-purple-600 hover:text-white"
									>No</button
								>
							</div>
							<div
								class="rounded border border-dashed border-slate-800 p-1 text-center font-mono text-[7px] text-slate-500"
							>
								ESC to toggle
							</div>
						</div>
					</div>

					<!-- Subtitle for the graphic -->
					<div class="mt-4 font-mono text-[10px] leading-relaxed text-slate-500">
						<span class="font-bold text-slate-800">// EDGE INJECTION:</span> The feedback overlay is auto-compiled
						and injected directly into the HTML5 game stream without modifying your build.
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Process / Features Section -->
	<div
		id="features"
		class="border-b border-purple-200/40 bg-white/10 px-6 py-20 backdrop-blur-sm lg:px-16"
	>
		<div class="mx-auto max-w-7xl">
			<div class="mb-16 max-w-xl">
				<span class="font-mono text-xs font-bold tracking-widest text-purple-700 uppercase"
					>Methodology</span
				>
				<h2 class="mt-2 font-mono text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
					ZERO-FRICTION TESTING PIPELINE
				</h2>
				<p class="mt-4 text-sm leading-relaxed font-medium text-slate-600">
					No installs. No authentication requirements for testers. Just simple web links that track
					analytics, collect player feedback, and log browser console warnings natively.
				</p>
			</div>

			<div
				class="grid grid-cols-1 divide-y divide-purple-200/40 border-t border-b border-purple-200/40 md:grid-cols-3 md:divide-x md:divide-y-0"
			>
				<!-- Step 1 -->
				<div class="group p-8 transition-colors duration-150 hover:bg-white/40 md:p-12">
					<div class="mb-6 font-mono text-xs font-bold text-purple-500">[ 01 / BUILD ]</div>
					<h3
						class="mb-3 flex items-center gap-2 font-mono text-lg font-black text-slate-900 uppercase"
					>
						<Layers class="h-4 w-4 text-purple-600" /> Client-side Zip
					</h3>
					<p class="text-xs leading-relaxed text-slate-500">
						Drag and drop your HTML5 build directory. Decompression executes locally in your browser
						before chunks are piped securely to Cloudflare R2 storage.
					</p>
				</div>

				<!-- Step 2 -->
				<div class="group p-8 transition-colors duration-150 hover:bg-white/40 md:p-12">
					<div class="mb-6 font-mono text-xs font-bold text-purple-500">[ 02 / STREAM ]</div>
					<h3
						class="mb-3 flex items-center gap-2 font-mono text-lg font-black text-slate-900 uppercase"
					>
						<Activity class="h-4 w-4 text-pink-600" /> Edge Injection
					</h3>
					<p class="text-xs leading-relaxed text-slate-500">
						When pages are loaded, our Cloudflare edge router streams the static files and
						dynamically appends the telemetry SDK before it reaches the player.
					</p>
				</div>

				<!-- Step 3 -->
				<div class="group p-8 transition-colors duration-150 hover:bg-white/40 md:p-12">
					<div class="mb-6 font-mono text-xs font-bold text-purple-500">[ 03 / OBSERVE ]</div>
					<h3
						class="mb-3 flex items-center gap-2 font-mono text-lg font-black text-slate-900 uppercase"
					>
						<Terminal class="h-4 w-4 text-indigo-600" /> Diagnostics
					</h3>
					<p class="text-xs leading-relaxed text-slate-500">
						Review heartbeats, browser exceptions, frame rate charts, and tester qualitative reports
						in your real-time developer hub.
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Pricing / Rate Card Section -->
	<div class="px-6 py-20 lg:px-16">
		<div class="mx-auto max-w-7xl">
			<div class="mb-16 text-center">
				<span class="font-mono text-xs font-bold tracking-widest text-purple-700 uppercase"
					>RATE SPECIFICATION</span
				>
				<h2 class="mt-2 font-mono text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
					TRANSPARENT VALUE LEDGER
				</h2>
				<p class="mx-auto mt-4 max-w-md text-xs font-bold text-slate-500">
					No recurring subscription traps. Purchase lifetime telemetry slots for individual game
					projects as needed.
				</p>
			</div>

			<div
				class="mx-auto grid max-w-4xl grid-cols-1 divide-y divide-purple-200/40 border border-purple-200/50 bg-white/40 shadow-2xl backdrop-blur-md md:grid-cols-2 md:divide-x md:divide-y-0"
			>
				<!-- Free Tier -->
				<div class="flex flex-col justify-between p-8 md:p-12">
					<div>
						<div class="mb-2 font-mono text-xs text-slate-400">[ PLAN: FREE_JAMMER ]</div>
						<h3 class="mb-4 font-mono text-2xl font-black text-slate-800 uppercase">Prototype</h3>
						<p class="mb-6 text-xs leading-relaxed text-slate-500">
							Designed for weekend game jams and testing quick mockups with friends.
						</p>

						<div class="mb-8 flex items-baseline gap-1">
							<span class="font-mono text-5xl font-black text-slate-800">£0</span>
							<span class="font-mono text-[10px] font-bold text-slate-400 uppercase"
								>Free Forever</span
							>
						</div>

						<ul
							class="mb-8 space-y-3 border-t border-dashed border-purple-200/40 pt-6 font-mono text-[10px] text-slate-600"
						>
							<li class="flex items-center gap-2">
								<span class="text-emerald-500">✓</span> 1 ACTIVE PROJECT SLOT
							</li>
							<li class="flex items-center gap-2">
								<span class="text-emerald-500">✓</span> MAX 3 CONCURRENT TESTERS
							</li>
							<li class="flex items-center gap-2">
								<span class="text-emerald-500">✓</span> 40MB FILE SIZE LIMIT
							</li>
							<li class="flex items-center gap-2 text-slate-400 line-through">
								<span>✕</span> DETAILED DIAGNOSTICS & LOGS
							</li>
							<li class="flex items-center gap-2 text-slate-400 line-through">
								<span>✕</span> EXCEPTION & PERFORMANCE METRICS
							</li>
						</ul>
					</div>

					<a
						href={resolve('/(app)/auth')}
						class="text-slate-850 w-full border border-slate-900 bg-transparent py-3 text-center font-mono text-xs font-bold tracking-wider uppercase transition-all duration-150 hover:bg-slate-900 hover:text-white"
					>
						Claim Free Slot
					</a>
				</div>

				<!-- Pro Tier -->
				<div class="flex flex-col justify-between bg-purple-500/[0.02] p-8 md:p-12">
					<div>
						<div class="mb-2 font-mono text-xs text-purple-500">[ PLAN: PROJECT_PASS ]</div>
						<h3
							class="mb-4 flex items-center gap-1.5 font-mono text-2xl font-black text-slate-800 uppercase"
						>
							<Shield class="h-5 w-5 text-purple-600" /> Commercial
						</h3>
						<p class="mb-6 text-xs leading-relaxed text-slate-500">
							Complete data retention and deep metrics analysis for commercial indie releases.
						</p>

						<div class="mb-8 flex items-baseline gap-1">
							<span class="font-mono text-5xl font-black text-slate-800">£15</span>
							<span class="font-mono text-[10px] font-bold text-purple-600 uppercase"
								>One-Time Fee</span
							>
						</div>

						<ul
							class="mb-8 space-y-3 border-t border-dashed border-purple-200/40 pt-6 font-mono text-[10px] text-slate-600"
						>
							<li class="flex items-center gap-2 font-bold text-slate-800">
								<span class="text-purple-600">★</span> LIFETIME HOSTING & RETENTION
							</li>
							<li class="flex items-center gap-2">
								<span class="text-purple-600">★</span> UP TO 500 UNIQUE SESSIONS
							</li>
							<li class="flex items-center gap-2">
								<span class="text-purple-600">★</span> UNCEILINGED UPLOAD CAPACITY
							</li>
							<li class="flex items-center gap-2">
								<span class="text-purple-600">★</span> DETAILED HEARTBEATS & LOGS
							</li>
							<li class="flex items-center gap-2">
								<span class="text-purple-600">★</span> FULL EXCEPTION & TRACE RECORDINGS
							</li>
						</ul>
					</div>

					<a
						href={resolve('/(app)/auth')}
						class="w-full border border-slate-900 bg-slate-900 py-3 text-center font-mono text-xs font-bold tracking-wider text-white uppercase transition-all duration-150 hover:bg-transparent hover:text-slate-900"
					>
						Get Project Pass
					</a>
				</div>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<Footer />
</div>
