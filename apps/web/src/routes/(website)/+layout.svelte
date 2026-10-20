<script lang="ts">
	import '../layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { Dithering } from '@devmischief/shaders-svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div
	class="relative min-h-screen overflow-x-hidden text-slate-800 antialiased selection:bg-purple-200 selection:text-purple-900"
>
	<!-- Fixed background shader layer -->
	<div
		class="pointer-events-none fixed inset-0 -z-50 flex h-screen w-screen items-center justify-center overflow-hidden bg-[#f5f3ff]"
	>
		<div class="h-full w-full opacity-60 md:opacity-75">
			<Dithering
				width={1280}
				height={720}
				colorBack="#f5f3ff"
				colorFront="#8b5cf6"
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
		<div
			class="pointer-events-none absolute inset-0 bg-radial-[circle_at_center,transparent_10%,#f5f3ff_95%] opacity-85"
		></div>
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-[#f5f3ff] to-transparent"
		></div>
	</div>

	<!-- Layout Main Content Container -->
	<div class="relative z-10 flex min-h-screen flex-col">
		{@render children()}
	</div>
</div>
