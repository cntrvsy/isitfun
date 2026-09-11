<script lang="ts">
	import Footer from '#lib/components/Footer.svelte';
	import { resolve } from '$app/paths';
	import { ArrowLeft } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Terms of Service | IsItFun</title>
	<meta name="description" content="Terms of Service and conditions for using IsItFun game playtesting platform." />
</svelte:head>

<div class="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 selection:bg-purple-100 selection:text-purple-900">
	<!-- Top Navigation -->
	<header class="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5 lg:px-8">
			<a
				href={resolve('/(website)')}
				class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
			>
				<ArrowLeft class="h-4 w-4" /> Back to IsItFun
			</a>
			<span class="text-xs font-bold text-slate-900">IsItFun Platform</span>
		</div>
	</header>

	<main class="mx-auto mt-10 w-full max-w-3xl flex-1 px-6 pb-24">
		<div class="mb-8">
			<span class="text-xs font-semibold text-purple-700 uppercase tracking-wider">Legal</span>
			<h1 class="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">Terms of Service</h1>
			<p class="mt-2 text-xs text-slate-500">Last updated: August 24, 2026</p>
		</div>

		<div class="space-y-8 rounded-2xl border border-slate-200 bg-white p-8 text-xs leading-relaxed text-slate-600 shadow-xs">
			<section>
				<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">1. Acceptance of Terms</h2>
				<p class="mt-2">
					By creating an account, uploading game builds, or participating in a playtest on IsItFun ("the Service"), you agree to be bound by these Terms of Service. If you are using the Service on behalf of an organization or game studio, you represent that you have authority to bind that entity to these terms.
				</p>
			</section>

			<section>
				<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">2. Developer Intellectual Property & Game Builds</h2>
				<p class="mt-2">
					You retain 100% full intellectual property ownership of all games, binaries, graphics, audio, code, and assets uploaded to IsItFun. IsItFun does not claim any ownership rights over your creative works. You grant IsItFun a non-exclusive license solely to host, decompress, stream to authorized playtesters, and collect telemetry data on your behalf.
				</p>
			</section>

			<section>
				<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">3. Acceptable Use & Content Policy</h2>
				<p class="mt-2">
					You agree not to upload any malicious code, malware, keyloggers, cryptominers, or content that infringes upon third-party copyrights or trademarks. Any game builds found violating applicable laws or containing malicious payloads will be purged immediately without refund.
				</p>
			</section>

			<section>
				<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">4. Telemetry Collection & Fair Usage</h2>
				<p class="mt-2">
					IsItFun collects anonymous runtime telemetry (frame rates, device hardware specs, browser exceptions, and qualitative ratings). Projects on the Free tier are subject to rate limits of 5,000 logs/day and 7-day log retention. Projects upgraded with a Commercial Project Pass receive extended lifetime log retention and unthrottled ingestion.
				</p>
			</section>

			<section>
				<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">5. Billing & Upgrades</h2>
				<p class="mt-2">
					Project Passes are one-time payments granting commercial telemetry capacity for a specific project. Workspace Team subscriptions are recurring monthly seat licenses billed via our payment processor (Creem / Stripe). Subscriptions may be cancelled at any time from your team management dashboard.
				</p>
			</section>

			<section>
				<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">6. Limitation of Liability</h2>
				<p class="mt-2">
					The Service is provided "as is" without warranty of any kind. In no event shall IsItFun or FR Studios be liable for any lost profits, lost data, or indirect damages resulting from server downtime, edge routing interruptions, or playtest outages.
				</p>
			</section>
		</div>
	</main>

	<Footer />
</div>
