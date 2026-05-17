<script lang="ts">
	import Footer from "$lib/components/Footer.svelte";
	// import { resolve } from "$app/paths";
	import { CloudUpload, MessageSquare, BarChart3 } from "@lucide/svelte";
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
				
				<!-- <a 
					href={resolve("/auth/login")} 
					class="group inline-flex items-center gap-3 px-8 py-4 bg-[#2b66d9] text-white font-black text-lg rounded-2xl shadow-lg shadow-[#2b66d9]/20 hover:shadow-[#2b66d9]/40 hover:bg-[#1d4ed8] active:scale-[0.98] transition-all duration-300 cursor-pointer"
				>
					Get Started
					<ArrowRight class="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
				</a> -->

				<!-- still under construction :D -->
				<p class="alert alert-error"> It's still under construction. so stay tuned.</p>
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

		</div>
	</div>

	<!-- Footer -->
	<Footer />
</div>