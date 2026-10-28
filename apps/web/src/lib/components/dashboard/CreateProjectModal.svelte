<script lang="ts">
	import { createProject } from '../../../routes/(app)/portal/dashboard/dashboard.remote';
	import { X, KeyRound, AlertCircle } from '@lucide/svelte';

	let { show = $bindable(false), organizationId = '' } = $props();
	let errorMessage = $state<string | null>(null);
</script>

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
	>
		<div
			class="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
		>
			<header class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
				<h3 class="text-lg font-bold tracking-tight text-slate-900">Create New Playtest</h3>
				<button
					onclick={() => {
						show = false;
						errorMessage = null;
					}}
					class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					aria-label="Close modal"
				>
					<X class="h-4 w-4" />
				</button>
			</header>

			<form
				{...createProject.enhance(async ({ submit, element }: any) => {
					errorMessage = null;
					try {
						if (await submit()) {
							show = false;
							element.reset();
						} else {
							errorMessage = 'Failed to create project. Free tier is limited to 1 active project.';
						}
					} catch (e: any) {
						errorMessage = e?.message || 'An unexpected error occurred while creating project.';
					}
				})}
				class="space-y-5 p-6"
			>
				{#if errorMessage}
					<div
						class="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
					>
						<AlertCircle class="h-4 w-4 shrink-0" />
						<span>{errorMessage}</span>
					</div>
				{/if}

				{#if organizationId}
					<input type="hidden" name="organizationId" value={organizationId} />
				{/if}
				<div>
					<label class="mb-1.5 block text-xs font-semibold text-slate-700" for="project-name">
						Project Name
					</label>
					<input
						id="project-name"
						placeholder="e.g. My Amazing Platformer"
						class="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 transition-all focus:border-purple-600 focus:outline-none"
						required
						{...createProject.fields.name.as('text')}
					/>
				</div>

				<div class="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
					<div class="flex items-start gap-3">
						<KeyRound class="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
						<div>
							<span class="block text-xs font-bold text-slate-900">Access Key Protection</span>
							<span class="mt-0.5 block text-[11px] leading-relaxed text-slate-600">
								A default playtest access key with 20 uses will be generated automatically. You can
								create custom keys, set expiry dates, or allow unlimited testers in the project
								settings.
							</span>
						</div>
					</div>
				</div>

				<footer class="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
					<button
						type="button"
						onclick={() => {
							show = false;
							errorMessage = null;
						}}
						class="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
					>
						Create Project
					</button>
				</footer>
			</form>
		</div>
	</div>
{/if}
