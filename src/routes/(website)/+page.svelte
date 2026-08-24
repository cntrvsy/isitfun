<script lang="ts">
	import Footer from '#lib/components/Footer.svelte';
	import { resolve } from '$app/paths';
	import {
		ArrowRight,
		Play,
		Layers,
		Activity,
		Terminal,
		Check,
		Zap,
		ShieldCheck,
		ExternalLink
	} from '@lucide/svelte';
</script>

<svelte:head>
	<title>Is It Fun? — Fast, Lightweight Game Playtest Telemetry</title>
	<meta
		name="description"
		content="Stop guessing if your core loop works. Deploy WebGL/HTML5 builds to the edge, invite testers with zero friction, and capture actionable playtest telemetry."
	/>
</svelte:head>

<div class="flex min-h-screen flex-col bg-slate-50 text-slate-900 selection:bg-purple-100 selection:text-purple-900">
	<!-- Top Navigation -->
	<header class="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
		<div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-12">
			<div class="flex items-center gap-3">
				<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-sm">
					🎮
				</div>
				<span class="text-base font-bold tracking-tight text-slate-900">IsItFun</span>
			</div>
			<div class="flex items-center gap-4">
				<a
					href="#how-it-works"
					class="text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900"
				>
					How it works
				</a>
				<a
					href="#pricing"
					class="text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900"
				>
					Pricing
				</a>
				<a
					href={resolve('/(app)/auth')}
					class="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-slate-800"
				>
					Sign In
				</a>
			</div>
		</div>
	</header>

	<!-- Hero Section -->
	<section class="relative border-b border-slate-200/80 px-6 py-20 md:py-28 lg:px-12">
		<div class="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
			<!-- Hero Left -->
			<div class="flex flex-col justify-center lg:col-span-7">
				<div class="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-purple-700">
					<span class="h-2 w-2 rounded-full bg-purple-600"></span>
					Playtest Telemetry Engine
				</div>

				<h1 class="mb-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
					Know if your game is fun before you build the rest.
				</h1>

				<p class="mb-8 max-w-xl text-base leading-relaxed text-slate-600">
					Deploy WebGL/HTML5 builds to the edge in seconds. Invite testers with instant links,
					record frame rates, capture console exceptions, and gather structured player feedback.
				</p>

				<div class="flex flex-col gap-3 sm:flex-row">
					<a
						href={resolve('/(app)/auth')}
						class="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-xs font-semibold text-white transition-all hover:bg-slate-800"
					>
						Start Free Playtest
						<ArrowRight class="h-4 w-4" />
					</a>
					<a
						href="#how-it-works"
						class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50"
					>
						See How It Works
					</a>
				</div>
			</div>

			<!-- Hero Right: Crisp Live Stream Preview -->
			<div class="flex items-center justify-center lg:col-span-5">
				<div class="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
					<!-- Top Window Header -->
					<div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
						<div class="flex items-center gap-1.5">
							<div class="h-2.5 w-2.5 rounded-full bg-rose-400"></div>
							<div class="h-2.5 w-2.5 rounded-full bg-amber-400"></div>
							<div class="h-2.5 w-2.5 rounded-full bg-emerald-400"></div>
						</div>
						<span class="font-mono text-[11px] font-medium text-slate-500">live-stream.telemetry</span>
						<span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
							<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> 60 FPS
						</span>
					</div>

					<!-- Content Preview -->
					<div class="p-5 space-y-4">
						<div class="rounded-xl border border-slate-100 bg-slate-900 p-4 font-mono text-xs text-slate-200">
							<div class="flex items-center justify-between pb-2 border-b border-slate-800 text-[10px] text-slate-400">
								<span>SESSION: 8f9b-42c1</span>
								<span>BUILD: v1.0.4</span>
							</div>
							<div class="mt-2 space-y-1.5 text-[11px]">
								<p class="text-purple-300">&gt; player_spawn &#123; stage: "intro", hp: 100 &#125;</p>
								<p class="text-blue-300">&gt; checkpoint_reached &#123; time: 24.8s &#125;</p>
								<p class="text-emerald-300">&gt; feedback_received: "fun" (satisfaction: 92%)</p>
							</div>
						</div>

						<div class="grid grid-cols-3 gap-2 text-center">
							<div class="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
								<span class="block text-[10px] font-semibold text-slate-500 uppercase">Avg FPS</span>
								<span class="font-mono text-sm font-bold text-slate-900">59.8</span>
							</div>
							<div class="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
								<span class="block text-[10px] font-semibold text-slate-500 uppercase">Duration</span>
								<span class="font-mono text-sm font-bold text-slate-900">142s</span>
							</div>
							<div class="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5">
								<span class="block text-[10px] font-semibold text-emerald-700 uppercase">Sentiment</span>
								<span class="font-mono text-sm font-bold text-emerald-700">Fun</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- How It Works Section -->
	<section id="how-it-works" class="border-b border-slate-200/80 bg-white px-6 py-20 lg:px-12">
		<div class="mx-auto max-w-7xl">
			<div class="mb-14 max-w-xl">
				<span class="text-xs font-semibold text-purple-700">How It Works</span>
				<h2 class="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
					Zero-friction testing pipeline
				</h2>
				<p class="mt-3 text-sm leading-relaxed text-slate-600">
					No player installations or account creation required. Send players a direct link and capture
					telemetry in real time.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-8 md:grid-cols-3">
				<!-- Step 1 -->
				<div class="rounded-2xl border border-slate-200 bg-slate-50/50 p-8">
					<div class="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
						<Layers class="h-5 w-5" />
					</div>
					<h3 class="mb-2 text-lg font-bold text-slate-900">1. Upload Build</h3>
					<p class="text-xs leading-relaxed text-slate-600">
						Drop your HTML5 export ZIP (Godot, Unity, Phaser, or Canvas). Files are distributed across Cloudflare's global edge network.
					</p>
				</div>

				<!-- Step 2 -->
				<div class="rounded-2xl border border-slate-200 bg-slate-50/50 p-8">
					<div class="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-pink-100 text-pink-700">
						<Activity class="h-5 w-5" />
					</div>
					<h3 class="mb-2 text-lg font-bold text-slate-900">2. Stream & Overlay</h3>
					<p class="text-xs leading-relaxed text-slate-600">
						The lightweight telemetry SDK is automatically injected into the stream, embedding FPS meters and feedback tools.
					</p>
				</div>

				<!-- Step 3 -->
				<div class="rounded-2xl border border-slate-200 bg-slate-50/50 p-8">
					<div class="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
						<Terminal class="h-5 w-5" />
					</div>
					<h3 class="mb-2 text-lg font-bold text-slate-900">3. Review Insights</h3>
					<p class="text-xs leading-relaxed text-slate-600">
						Track player satisfaction percentages, console errors, stack traces, and device hardware specs from your dashboard.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Pricing Section -->
	<section id="pricing" class="px-6 py-20 lg:px-12">
		<div class="mx-auto max-w-7xl">
			<div class="mb-14 text-center">
				<span class="text-xs font-semibold text-purple-700">Pricing</span>
				<h2 class="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
					Simple, transparent pricing
				</h2>
				<p class="mx-auto mt-3 max-w-md text-sm text-slate-600">
					No recurring subscription traps. Start free for weekend jams or purchase a lifetime pass per project.
				</p>
			</div>

			<div class="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
				<!-- Free Tier -->
				<div class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
					<div>
						<div class="mb-1 text-xs font-semibold text-slate-500">PROTOTYPE</div>
						<h3 class="mb-2 text-2xl font-bold text-slate-900">Free</h3>
						<p class="mb-6 text-xs leading-relaxed text-slate-600">
							Ideal for weekend prototypes and sharing with friends.
						</p>

						<div class="mb-6 flex items-baseline gap-1">
							<span class="text-4xl font-extrabold text-slate-900">£0</span>
							<span class="text-xs font-medium text-slate-500">/ forever</span>
						</div>

						<ul class="mb-8 space-y-3 border-t border-slate-100 pt-6 text-xs text-slate-600">
							<li class="flex items-center gap-2.5">
								<Check class="h-4 w-4 text-emerald-600" /> 1 active playtest project
							</li>
							<li class="flex items-center gap-2.5">
								<Check class="h-4 w-4 text-emerald-600" /> Up to 5,000 monthly telemetry events
							</li>
							<li class="flex items-center gap-2.5">
								<Check class="h-4 w-4 text-emerald-600" /> 7-day log retention
							</li>
							<li class="flex items-center gap-2.5">
								<Check class="h-4 w-4 text-emerald-600" /> Basic player sentiment ratings
							</li>
						</ul>
					</div>

					<a
						href={resolve('/(app)/auth')}
						class="w-full rounded-lg border border-slate-200 py-3 text-center text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50"
					>
						Get Started Free
					</a>
				</div>

				<!-- Pro Tier -->
				<div class="flex flex-col justify-between rounded-2xl border-2 border-purple-600 bg-white p-8 shadow-md relative">
					<div class="absolute -top-3 right-6 rounded-full bg-purple-600 px-3 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider">
						Popular
					</div>

					<div>
						<div class="mb-1 text-xs font-semibold text-purple-700">COMMERCIAL</div>
						<h3 class="mb-2 text-2xl font-bold text-slate-900">Project Pass</h3>
						<p class="mb-6 text-xs leading-relaxed text-slate-600">
							Lifetime data retention and full analytics for commercial game releases.
						</p>

						<div class="mb-6 flex items-baseline gap-1">
							<span class="text-4xl font-extrabold text-slate-900">£15</span>
							<span class="text-xs font-medium text-slate-500">/ one-time fee</span>
						</div>

						<ul class="mb-8 space-y-3 border-t border-slate-100 pt-6 text-xs text-slate-600">
							<li class="flex items-center gap-2.5 font-medium text-slate-900">
								<Check class="h-4 w-4 text-purple-600" /> Lifetime project hosting & retention
							</li>
							<li class="flex items-center gap-2.5">
								<Check class="h-4 w-4 text-purple-600" /> 100,000 monthly telemetry events
							</li>
							<li class="flex items-center gap-2.5">
								<Check class="h-4 w-4 text-purple-600" /> Full console error & stack trace captures
							</li>
							<li class="flex items-center gap-2.5">
								<Check class="h-4 w-4 text-purple-600" /> Raw JSON, CSV & ZIP dataset export
							</li>
						</ul>
					</div>

					<a
						href={resolve('/(app)/auth')}
						class="w-full rounded-lg bg-purple-600 py-3 text-center text-xs font-semibold text-white transition-all hover:bg-purple-700"
					>
						Get Project Pass
					</a>
				</div>
			</div>
		</div>
	</section>

	<Footer />
</div>
