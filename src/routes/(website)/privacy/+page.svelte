<script lang="ts">
	import Footer from '#lib/components/Footer.svelte';
	import { resolve } from '$app/paths';
	import { ArrowLeft } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Privacy Policy | IsItFun</title>
	<meta name="description" content="Privacy Policy and data processing practices on IsItFun." />
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
			<h1 class="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">Privacy Policy</h1>
			<p class="mt-2 text-xs text-slate-500">Last updated: August 24, 2026</p>
		</div>

		<div class="space-y-8 rounded-2xl border border-slate-200 bg-white p-8 text-xs leading-relaxed text-slate-600 shadow-xs">
			<section>
				<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">1. Information We Collect</h2>
				<p class="mt-2">
					We collect two distinct categories of information: <strong>Account Information</strong> and <strong>Playtest Telemetry</strong>.
				</p>
				<ul class="mt-3 list-disc space-y-1.5 pl-5 text-slate-600">
					<li><strong>Account Data:</strong> Email address, developer name, profile details, and authentication identifiers provided during registration.</li>
					<li><strong>Playtest Telemetry:</strong> Anonymized runtime metrics collected during game playtests, including frame rate samples, GPU renderers, browser error stack traces, session durations, and user sentiment ratings.</li>
				</ul>
			</section>

			<section>
				<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">2. How Telemetry is Processed</h2>
				<p class="mt-2">
					Playtester telemetry is buffered on Cloudflare Edge Durable Objects and stored in our encrypted SQLite databases. We do not track personal identifying information (PII) of playtesters. Telemetry is solely visible to the game developer or team members with authorized access to that project workspace.
				</p>
			</section>

			<section>
				<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">3. Cookies & Session Storage</h2>
				<p class="mt-2">
					IsItFun uses essential HTTP-only cookies for developer session authentication and password-protected playtest gate authorization (`play_auth_*`). We do not use third-party tracking or advertising cookies.
				</p>
			</section>

			<section>
				<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">4. Third-Party Service Providers</h2>
				<p class="mt-2">
					We partner with trusted infrastructure providers to deliver our service:
				</p>
				<ul class="mt-3 list-disc space-y-1.5 pl-5 text-slate-600">
					<li><strong>Cloudflare:</strong> Edge routing, Durable Objects, D1 SQLite database, and R2 object storage.</li>
					<li><strong>Creem / Stripe:</strong> Payment processing and seat subscription management.</li>
					<li><strong>Resend:</strong> Transactional email delivery and team invitation notifications.</li>
				</ul>
			</section>

			<section>
				<h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">5. Data Retention & Deletion</h2>
				<p class="mt-2">
					Free tier playtest logs automatically expire and are purged after 7 days. Developers can permanently purge projects, assets, and all associated telemetry records at any time from their dashboard. Account deletion requests can be initiated via developer profile settings or support.
				</p>
			</section>
		</div>
	</main>

	<Footer />
</div>
