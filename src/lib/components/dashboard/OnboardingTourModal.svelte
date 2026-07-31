<script lang="ts">
	import { resolve } from '$app/paths';
	import { Gamepad2, Play, Activity, Sparkles, CheckCircle2, ChevronRight, X, ExternalLink } from 'lucide-svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen, onClose }: Props = $props();

	let currentStep = $state(1);

	const steps = [
		{
			id: 1,
			title: 'Welcome to IsItFun! - 4-Step Playtest Tour',
			description: 'Learn how playtests work from both the Developer and Player perspectives in under 2 minutes.'
		},
		{
			id: 2,
			title: 'Step 1: The Player Experience (Ping Pong)',
			description: 'Launch the built-in demo game in a new tab. Play Ping Pong, score points, and rate your fun via the bottom-right feedback pill!'
		},
		{
			id: 3,
			title: 'Step 2: Real-time Telemetry Ingestion',
			description: 'Watch telemetry events stream live from the browser into your dashboard as players interact with your game.'
		},
		{
			id: 4,
			title: 'Step 3: Performance & Console Inspector',
			description: 'Inspect detailed FPS charts, hardware concurrency, GPU renderers, and custom game event logs (`paddle_hit`, `point_scored`).'
		}
	];

	function nextStep() {
		if (currentStep < steps.length) {
			currentStep++;
		} else {
			onClose();
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
		}
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
		<div class="relative w-full max-w-2xl rounded-2xl border border-purple-500/30 bg-slate-900 shadow-2xl p-6 text-slate-100">
			<!-- Close Button -->
			<button
				onclick={onClose}
				class="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
			>
				<X class="h-5 w-5" />
			</button>

			<!-- Progress Header -->
			<div class="mb-6 flex items-center gap-2">
				{#each steps as step (step.id)}
					<div
						class="h-1.5 flex-1 rounded-full transition-all duration-300 {step.id === currentStep
							? 'bg-purple-500'
							: step.id < currentStep
								? 'bg-purple-800'
								: 'bg-slate-800'}"
					></div>
				{/each}
			</div>

			<!-- Content Area -->
			<div class="min-h-[280px]">
				{#if currentStep === 1}
					<div class="space-y-4">
						<div class="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
							<Sparkles class="h-3.5 w-3.5" /> Interactive Onboarding
						</div>
						<h2 class="text-2xl font-bold text-white">{steps[0].title}</h2>
						<p class="text-sm text-slate-300 leading-relaxed">{steps[0].description}</p>

						<div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
							<h3 class="text-xs font-semibold uppercase tracking-wider text-purple-400">What you will experience:</h3>
							<ul class="space-y-2 text-sm text-slate-300">
								<li class="flex items-center gap-2">
									<CheckCircle2 class="h-4 w-4 text-emerald-400 shrink-0" />
									<span><strong>Zero Setup:</strong> Play an HTML5 Canvas Ping Pong game embedded with telemetry tracking.</span>
								</li>
								<li class="flex items-center gap-2">
									<CheckCircle2 class="h-4 w-4 text-emerald-400 shrink-0" />
									<span><strong>Live Telemetry:</strong> Automatic FPS sampling, WebGL specs, and console logs.</span>
								</li>
								<li class="flex items-center gap-2">
									<CheckCircle2 class="h-4 w-4 text-emerald-400 shrink-0" />
									<span><strong>Custom Event Logging:</strong> Emitting custom events via <code>console.log('[IsItFun]', ...)</code>.</span>
								</li>
							</ul>
						</div>
					</div>
				{:else if currentStep === 2}
					<div class="space-y-4">
						<div class="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
							<Gamepad2 class="h-3.5 w-3.5" /> Step 1 of 3
						</div>
						<h2 class="text-2xl font-bold text-white">{steps[1].title}</h2>
						<p class="text-sm text-slate-300 leading-relaxed">{steps[1].description}</p>

						<div class="rounded-xl border border-purple-500/30 bg-purple-950/30 p-5 text-center space-y-3">
							<p class="text-xs text-purple-300">Click the button below to launch the Demo Ping Pong Playtest in a new tab:</p>
							<a
								href={resolve('/play/[projectId]/[...file]', { projectId: 'demo', file: '' })}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 transition-all"
							>
								<Play class="h-4 w-4 fill-current" /> Launch Ping Pong Game <ExternalLink class="h-4 w-4" />
							</a>
						</div>
					</div>
				{:else if currentStep === 3}
					<div class="space-y-4">
						<div class="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
							<Activity class="h-3.5 w-3.5" /> Step 2 of 3
						</div>
						<h2 class="text-2xl font-bold text-white">{steps[2].title}</h2>
						<p class="text-sm text-slate-300 leading-relaxed">{steps[2].description}</p>

						<div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
							<div class="flex items-center justify-between text-xs font-mono text-slate-400">
								<span>Live Telemetry Event Queue</span>
								<span class="text-emerald-400">● Streaming</span>
							</div>
							<div class="rounded-lg bg-slate-900 p-3 font-mono text-xs text-purple-300 space-y-1">
								<div>[IsItFun] paddle_hit &rarr; {JSON.stringify({ rallyCount: 3, speed: 7 })}</div>
								<div>[IsItFun] point_scored &rarr; {JSON.stringify({ scorer: 'player', playerScore: 1 })}</div>
								<div class="text-slate-400">[System] fps_sample &rarr; 60 avg, GPU: WebGL Renderer</div>
							</div>
						</div>
					</div>
				{:else if currentStep === 4}
					<div class="space-y-4">
						<div class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
							<CheckCircle2 class="h-3.5 w-3.5" /> Onboarding Complete!
						</div>
						<h2 class="text-2xl font-bold text-white">{steps[3].title}</h2>
						<p class="text-sm text-slate-300 leading-relaxed">
							You now understand how <strong>IsItFun?</strong> empowers game studios to collect real playtest data. Create your first project or test the demo anytime!
						</p>

						<div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
							<h3 class="text-xs font-semibold uppercase tracking-wider text-purple-400">Key Takeaways for Your Games:</h3>
							<ul class="space-y-1.5 text-xs text-slate-300">
								<li>• <strong>Any Game Engine:</strong> Unity C#, Godot GDScript, Unreal, or HTML5.</li>
								<li>• <strong>Console Event Capture:</strong> Use <code>console.log('[IsItFun]', eventName, data)</code>.</li>
								<li>• <strong>Protection:</strong> Access key passwords prevent uninvited players.</li>
							</ul>
						</div>
					</div>
				{/if}
			</div>

			<!-- Navigation Footer -->
			<div class="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
				<button
					onclick={prevStep}
					disabled={currentStep === 1}
					class="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
				>
					Previous
				</button>
				<button
					onclick={nextStep}
					class="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 hover:bg-purple-500 transition-all"
				>
					{currentStep === steps.length ? 'Finish Onboarding' : 'Next Step'} <ChevronRight class="h-4 w-4" />
				</button>
			</div>
		</div>
	</div>
{/if}
