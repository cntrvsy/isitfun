<script lang="ts">
	import '../layout.css';
	import favicon from '#lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div
	class="relative min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-purple-100 selection:text-purple-900"
>
	<!-- Crisp, lightweight subtle background grid -->
	<div
		class="pointer-events-none fixed inset-0 -z-50 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] mask-[radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40"
	></div>

	<!-- Layout Main Content Container -->
	<div class="relative z-10 flex min-h-screen flex-col">
		{@render children()}
	</div>
</div>
