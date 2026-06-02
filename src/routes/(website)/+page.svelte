<script lang="ts">
	import Footer from "$lib/components/Footer.svelte";
	import { resolve } from "$app/paths";
	import { CloudUpload, MessageSquare, BarChart3, Check, Zap, ArrowRight } from "@lucide/svelte";
</script>

<svelte:head>
	<title>Is It Fun? | Test Your Game Idea</title>
	<meta name="description" content="Test your game ideas with friends and family easily on the browser. Collect insights and find out if your game is worth pursuing." />
</svelte:head>

<div class="min-h-screen flex flex-col bg-transparent">
	<!-- Hero Section -->
	<div class="hero grow flex items-center justify-center py-16 px-4 md:py-28">
		<div class="hero-content text-center max-w-4xl mx-auto flex flex-col gap-16">
			
			<!-- Main Glassmorphic Showcase Card -->
			<div class="bg-white/40 backdrop-blur-xl border border-black/10 rounded-[2.5rem] p-8 md:p-16 shadow-[0_0_50px_rgba(43,102,217,0.03)] hover:shadow-[0_0_50px_rgba(43,102,217,0.08)] hover:border-[#2b66d9]/30 transition-all duration-500 max-w-2xl mx-auto flex flex-col items-center">
				
				<h1 class="text-5xl md:text-6xl font-black tracking-tight mb-6">
					<span class="bg-linear-to-r from-[#2b66d9] via-[#8b5cf6] to-[#2b66d9] bg-clip-text text-transparent">
						Is It Fun?
					</span>
				</h1>
				
				<p class="text-lg md:text-xl text-slate-600 font-semibold mb-10 leading-relaxed max-w-lg">
					A simple web application to share prototypes with your community and gather real-time feedback about whether your game is fun to play.
				</p>
				
				<a 
					href={resolve("/auth/login")} 
					class="group inline-flex items-center gap-3 px-8 py-4 bg-[#2b66d9] text-white font-black text-lg rounded-2xl shadow-lg shadow-[#2b66d9]/20 hover:shadow-[#2b66d9]/40 hover:bg-[#1d4ed8] active:scale-[0.98] transition-all duration-300 cursor-pointer"
				>
					Get Started
					<ArrowRight class="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
				</a>
			</div>

			<!-- Three-Pillar Feature Grid -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
				<!-- Feature 1 -->
				<div class="bg-white/30 backdrop-blur-lg border border-black/5 rounded-2xl p-8 flex flex-col items-center text-center hover:border-[#2b66d9]/20 hover:bg-white/50 transition-all duration-300 group">
					<div class="w-12 h-12 rounded-xl bg-[#2b66d9]/10 flex items-center justify-center text-[#2b66d9] mb-5 border border-[#2b66d9]/15 group-hover:scale-110 transition-transform duration-300">
						<CloudUpload class="w-6 h-6" />
					</div>
					<h3 class="text-lg font-bold text-slate-800 mb-2">Publish Easily</h3>
					<p class="text-sm text-slate-500 leading-relaxed">
						Upload your WebGL or HTML5 build to the cloud and share a playtest link with your audience instantly.
					</p>
				</div>

				<!-- Feature 2 -->
				<div class="bg-white/30 backdrop-blur-lg border border-black/5 rounded-2xl p-8 flex flex-col items-center text-center hover:border-[#2b66d9]/20 hover:bg-white/50 transition-all duration-300 group">
					<div class="w-12 h-12 rounded-xl bg-[#2b66d9]/10 flex items-center justify-center text-[#2b66d9] mb-5 border border-[#2b66d9]/15 group-hover:scale-110 transition-transform duration-300">
						<MessageSquare class="w-6 h-6" />
					</div>
					<h3 class="text-lg font-bold text-slate-800 mb-2">Collect Feedback</h3>
					<p class="text-sm text-slate-500 leading-relaxed">
						Players submit dynamic structured surveys and qualitative reviews directly from their browser window.
					</p>
				</div>

				<!-- Feature 3 -->
				<div class="bg-white/30 backdrop-blur-lg border border-black/5 rounded-2xl p-8 flex flex-col items-center text-center hover:border-[#2b66d9]/20 hover:bg-white/50 transition-all duration-300 group">
					<div class="w-12 h-12 rounded-xl bg-[#2b66d9]/10 flex items-center justify-center text-[#2b66d9] mb-5 border border-[#2b66d9]/15 group-hover:scale-110 transition-transform duration-300">
						<BarChart3 class="w-6 h-6" />
					</div>
					<h3 class="text-lg font-bold text-slate-800 mb-2">Analyze Fun</h3>
					<p class="text-sm text-slate-500 leading-relaxed">
						Track player retention and review synthesized analytical dashboards to see if your game loops are truly engaging.
					</p>
				</div>
			</div>

			<!-- Pricing Section -->
			<div class="mt-20 text-center w-full">
				<h2 class="text-3xl md:text-4xl font-extrabold text-slate-800 mb-4 tracking-tight">
					Simple, Fair Indie Pricing
				</h2>
				<p class="text-slate-500 max-w-lg mx-auto text-base">
					Pay once per game, unlock it forever. No monthly subscriptions to worry about during active coding phases.
				</p>
			</div>

			<!-- Pricing Grid -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full mt-2">
				<!-- Free Jammer Tier -->
				<div class="bg-white/40 backdrop-blur-xl border border-black/5 rounded-[2rem] p-8 md:p-10 shadow-lg flex flex-col hover:border-slate-300 hover:shadow-2xl transition-all duration-500 relative overflow-hidden group">
					<div class="mb-6 text-left">
						<span class="text-xs uppercase font-extrabold tracking-widest text-[#2b66d9] bg-[#2b66d9]/10 px-3 py-1 rounded-full">
							Free Jammer
						</span>
						<h3 class="text-2xl font-bold text-slate-800 mt-4 mb-2">Prototype Testing</h3>
						<p class="text-sm text-slate-500">Perfect for weekend game jams and quick playtest validation.</p>
					</div>

					<div class="my-6 text-left flex items-baseline gap-1">
						<span class="text-5xl font-black text-slate-800">£0</span>
						<span class="text-sm font-semibold text-slate-500">free forever</span>
					</div>

					<ul class="space-y-4 my-6 text-left flex-grow">
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="w-5 h-5 text-emerald-500 shrink-0" />
							<span><strong>1 active project</strong> upload</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="w-5 h-5 text-emerald-500 shrink-0" />
							<span><strong>Max 3 concurrent</strong> testing sessions</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="w-5 h-5 text-emerald-500 shrink-0" />
							<span>40 MB hard upload size limit</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="w-5 h-5 text-emerald-500 shrink-0" />
							<span>7-Day Log Decay Protocol</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="w-5 h-5 text-emerald-500 shrink-0" />
							<span>Banned heartbeats & detailed logs</span>
						</li>
					</ul>

					<a 
						href={resolve("/auth/login")} 
						class="btn w-full bg-slate-900 hover:bg-slate-800 border-none text-white font-bold py-4 rounded-xl shadow-lg transition-all duration-300 text-center"
					>
						Start Jamming
					</a>
				</div>

				<!-- Project Pass Tier -->
				<div class="bg-white/70 backdrop-blur-xl border border-[#2b66d9]/30 rounded-[2rem] p-8 md:p-10 shadow-2xl flex flex-col hover:border-[#2b66d9]/50 hover:shadow-2xl transition-all duration-500 relative overflow-hidden group">
					<!-- Glow effect -->
					<div class="absolute -top-24 -right-24 w-48 h-48 bg-linear-to-tr from-[#2b66d9]/10 to-[#8b5cf6]/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-500"></div>
					
					<div class="mb-6 text-left">
						<span class="text-xs uppercase font-extrabold tracking-widest text-white bg-linear-to-r from-[#2b66d9] to-[#8b5cf6] px-3 py-1 rounded-full shadow-md shadow-[#2b66d9]/20 inline-flex items-center gap-1.5">
							<Zap class="w-3 h-3 fill-current" /> Project Pass
						</span>
						<h3 class="text-2xl font-bold text-slate-800 mt-4 mb-2">Serious Indie Demo</h3>
						<p class="text-sm text-slate-500">Professional-grade diagnostics and telemetry for commercial builds.</p>
					</div>

					<div class="my-6 text-left flex items-baseline gap-1">
						<span class="text-5xl font-black text-slate-800">£15</span>
						<span class="text-sm font-semibold text-slate-500">one-time / project</span>
					</div>

					<ul class="space-y-4 my-6 text-left flex-grow">
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="w-5 h-5 text-emerald-500 shrink-0" />
							<span><strong>Lifetime</strong> project hosting & data retention</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="w-5 h-5 text-emerald-500 shrink-0" />
							<span><strong>Up to 500 unique</strong> playtest sessions</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="w-5 h-5 text-emerald-500 shrink-0" />
							<span>No file size upload ceiling</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="w-5 h-5 text-emerald-500 shrink-0" />
							<span>30 days of data retention per test</span>
						</li>
						<li class="flex items-center gap-3 text-sm text-slate-600">
							<Check class="w-5 h-5 text-emerald-500 shrink-0" />
							<span><strong>Full diagnostics</strong>: heartbeats, logs, exceptions</span>
						</li>
					</ul>

					<a 
						href={resolve("/auth/login")} 
						class="btn w-full bg-linear-to-r from-[#2b66d9] to-[#8b5cf6] hover:from-[#1d4ed8] hover:to-[#7c3aed] border-none text-white font-extrabold py-4 rounded-xl shadow-xl shadow-[#2b66d9]/25 hover:shadow-[#2b66d9]/40 hover:-translate-y-0.5 transition-all duration-300 text-center"
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