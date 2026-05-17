<script lang="ts">
	import '../layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Dithering } from '@devmischief/shaders-svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="relative min-h-screen text-[#1a1e26] antialiased overflow-x-hidden selection:bg-[#2b66d9]/20 selection:text-[#2b66d9]">
	<!-- Fixed background shader layer -->
	<div class="fixed inset-0 -z-50 pointer-events-none w-screen h-screen overflow-hidden flex items-center justify-center bg-[#f4f6f8]">
		<div class="w-full h-full opacity-60 md:opacity-75">
			<Dithering
				width={1280}
				height={720}
				colorBack="#f4f6f8"
				colorFront="#2b66d9"
				shape="warp"
				type="4x4"
				size={1}
				speed={1}
				scale={1}
				rotation={0}
				offsetX={0}
				offsetY={0}
				fit="none"
				style="width: 100% !important; height: 100% !important;"
			/>
		</div>
		<!-- Ambient lighting / Vignette overlays to enhance depth and contrast -->
		<div class="absolute inset-0 bg-radial-[circle_at_center,transparent_10%,#f4f6f8_95%] opacity-85 pointer-events-none"></div>
		<div class="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-[#f4f6f8] to-transparent pointer-events-none"></div>
	</div>

	<!-- Layout Main Content Container -->
	<div class="relative z-10 flex flex-col min-h-screen">
		{@render children()}
	</div>
</div>

