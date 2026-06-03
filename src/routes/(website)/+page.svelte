<script lang="ts">
	import Footer from '$lib/components/Footer.svelte';
	import { resolve } from '$app/paths';
	import { CloudUpload, MessageSquare, BarChart3, Check, Zap, ArrowRight } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Is It Fun? | Test Your Game Idea</title>
	<meta
		name="description"
		content="Test your game ideas with friends and family easily on the browser. Collect insights and find out if your game is worth pursuing."
	/>
</svelte:head>

<div class="flex min-h-screen flex-col bg-transparent">
	<!-- Hero Section -->
	<div class="hero flex grow items-center justify-center px-4 py-16 md:py-28">
		<div class="hero-content mx-auto flex max-w-4xl flex-col gap-16 text-center">
			<!-- Main Glassmorphic Showcase Card -->
			<div
				class="mx-auto flex max-w-2xl flex-col items-center rounded-[2.5rem] border border-black/10 bg-white/40 p-8 shadow-[0_0_50px_rgba(43,102,217,0.03)] backdrop-blur-xl transition-all duration-500 hover:border-[#2b66d9]/30 hover:shadow-[0_0_50px_rgba(43,102,217,0.08)] md:p-16"
			>
				<h1 class="mb-6 text-5xl font-black tracking-tight md:text-6xl">
					<span
						class="bg-linear-to-r from-[#2b66d9] via-[#8b5cf6] to-[#2b66d9] bg-clip-text text-transparent"
					>
						Is It Fun?
					</span>
				</h1>

				<p class="mb-10 max-w-lg text-lg leading-relaxed font-semibold text-slate-600 md:text-xl">
					A simple web application to share prototypes with your community and gather real-time
					feedback about whether your game is fun to play.
				</p>

				<a
					href={resolve('/auth/login')}
					class="group inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-[#2b66d9] px-8 py-4 text-lg font-black text-white shadow-lg shadow-[#2b66d9]/20 transition-all duration-300 hover:bg-[#1d4ed8] hover:shadow-[#2b66d9]/40 active:scale-[0.98]"
				>
					Get Started
					<ArrowRight class="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
				</a>
			</div>

			<!-- Three-Pillar Feature Grid -->
			<div class="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
				<!-- Feature 1 -->
				<div
					class="group flex flex-col items-center rounded-2xl border border-black/5 bg-white/30 p-8 text-center backdrop-blur-lg transition-all duration-300 hover:border-[#2b66d9]/20 hover:bg-white/50"
				>
					<div
						class="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[#2b66d9]/15 bg-[#2b66d9]/10 text-[#2b66d9] transition-transform duration-300 group-hover:scale-110"
					>
						<CloudUpload class="h-6 w-6" />
					</div>
					<h3 class="mb-2 text-lg font-bold text-slate-800">Publish Easily</h3>
					<p class="text-sm leading-relaxed text-slate-500">
						Upload your WebGL or HTML5 build to the cloud and share a playtest link with your
						audience instantly.
					</p>
				</div>

				<!-- Feature 2 -->
				<div
					class="group flex flex-col items-center rounded-2xl border border-black/5 bg-white/30 p-8 text-center backdrop-blur-lg transition-all duration-300 hover:border-[#2b66d9]/20 hover:bg-white/50"
				>
					<div
						class="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[#2b66d9]/15 bg-[#2b66d9]/10 text-[#2b66d9] transition-transform duration-300 group-hover:scale-110"
					>
						<MessageSquare class="h-6 w-6" />
					</div>
					<h3 class="mb-2 text-lg font-bold text-slate-800">Collect Feedback</h3>
					<p class="text-sm leading-relaxed text-slate-500">
						Players submit dynamic structured surveys and qualitative reviews directly from their
						browser window.
					</p>
				</div>

				<!-- Feature 3 -->
				<div
					class="group flex flex-col items-center rounded-2xl border border-black/5 bg-white/30 p-8 text-center backdrop-blur-lg transition-all duration-300 hover:border-[#2b66d9]/20 hover:bg-white/50"
				>
					<div
						class="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[#2b66d9]/15 bg-[#2b66d9]/10 text-[#2b66d9] transition-transform duration-300 group-hover:scale-110"
					>
						<BarChart3 class="h-6 w-6" />
					</div>
					<h3 class="mb-2 text-lg font-bold text-slate-800">Analyze Fun</h3>
					<p class="text-sm leading-relaxed text-slate-500">
						Track player retention and review synthesized analytical dashboards to see if your game
						loops are truly engaging.
					</p>
				</div>
			</div>

			<!-- Pricing Section -->
			<div class="mt-20 w-full text-center">
				<h2 class="mb-4 text-3xl font-extrabold tracking-tight text-slate-800 md:text-4xl">
					Simple, Fair Indie Pricing
				</h2>
				<p class="mx-auto max-w-lg text-base text-slate-500">
					Pay once per game, unlock it forever. No monthly subscriptions to worry about during
					active coding phases.
				</p>
			</div>

			<!-- Pricing Grid -->
			<div class="mx-auto mt-2 grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
				<!-- Free Jammer Tier -->
				<div
					class="group relative flex flex-col overflow-hidden rounded-[2rem] border border-black/5 bg-white/40 p-8 shadow-lg backdrop-blur-xl transition-all duration-500 hover:border-slate-300 hover:shadow-2xl md:p-10"
				>
					<div class="mb-6 text-left">
						<span
							class="rounded-full bg-[#2b66d9]/10 px-3 py-1 text-xs font-extrabold tracking-widest text-[#2b66d9] uppercase"
						>
							Free Jammer
						</span>
						<h3 class="mt-4 mb-2 text-2xl font-bold text-slate-800">Prototype Testing</h3>
						<p class="text-sm text-slate-500">
							Perfect for weekend game jams and quick playtest validation.
						</p>
					</div>

					<div class="my-6 flex items-baseline gap-1 text-left">
						<span class="text-5xl font-black text-slate-800">£0</span>
						<span class="text-sm font-semibold text-slate-500">free forever</span>
					</div>

					<ul class="my-6 flex-grow space-y-4 text-left">
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="h-5 w-5 shrink-0 text-emerald-500" />
							<span><strong>1 active project</strong> upload</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="h-5 w-5 shrink-0 text-emerald-500" />
							<span><strong>Max 3 concurrent</strong> testing sessions</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="h-5 w-5 shrink-0 text-emerald-500" />
							<span>40 MB hard upload size limit</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="h-5 w-5 shrink-0 text-emerald-500" />
							<span>7-Day Log Decay Protocol</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="h-5 w-5 shrink-0 text-emerald-500" />
							<span>Banned heartbeats & detailed logs</span>
						</li>
					</ul>

					<a
						href={resolve('/auth/login')}
						class="btn w-full rounded-xl border-none bg-slate-900 py-4 text-center font-bold text-white shadow-lg transition-all duration-300 hover:bg-slate-800"
					>
						Start Jamming
					</a>
				</div>

				<!-- Project Pass Tier -->
				<div
					class="group relative flex flex-col overflow-hidden rounded-[2rem] border border-[#2b66d9]/30 bg-white/70 p-8 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-[#2b66d9]/50 hover:shadow-2xl md:p-10"
				>
					<!-- Glow effect -->
					<div
						class="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-linear-to-tr from-[#2b66d9]/10 to-[#8b5cf6]/10 blur-3xl transition-transform duration-500 group-hover:scale-125"
					></div>

					<div class="mb-6 text-left">
						<span
							class="inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-[#2b66d9] to-[#8b5cf6] px-3 py-1 text-xs font-extrabold tracking-widest text-white uppercase shadow-md shadow-[#2b66d9]/20"
						>
							<Zap class="h-3 w-3 fill-current" /> Project Pass
						</span>
						<h3 class="mt-4 mb-2 text-2xl font-bold text-slate-800">Serious Indie Demo</h3>
						<p class="text-sm text-slate-500">
							Professional-grade diagnostics and telemetry for commercial builds.
						</p>
					</div>

					<div class="my-6 flex items-baseline gap-1 text-left">
						<span class="text-5xl font-black text-slate-800">£15</span>
						<span class="text-sm font-semibold text-slate-500">one-time / project</span>
					</div>

					<ul class="my-6 flex-grow space-y-4 text-left">
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="h-5 w-5 shrink-0 text-emerald-500" />
							<span><strong>Lifetime</strong> project hosting & data retention</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="h-5 w-5 shrink-0 text-emerald-500" />
							<span><strong>Up to 500 unique</strong> playtest sessions</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="h-5 w-5 shrink-0 text-emerald-500" />
							<span>No file size upload ceiling</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="h-5 w-5 shrink-0 text-emerald-500" />
							<span>30 days of data retention per test</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="h-5 w-5 shrink-0 text-emerald-500" />
							<span><strong>Full diagnostics</strong>: heartbeats, logs, exceptions</span>
						</li>
					</ul>

					<a
						href={resolve('/auth/login')}
						class="btn w-full rounded-xl border-none bg-linear-to-r from-[#2b66d9] to-[#8b5cf6] py-4 text-center font-extrabold text-white shadow-xl shadow-[#2b66d9]/25 transition-all duration-300 hover:-translate-y-0.5 hover:from-[#1d4ed8] hover:to-[#7c3aed] hover:shadow-[#2b66d9]/40"
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
