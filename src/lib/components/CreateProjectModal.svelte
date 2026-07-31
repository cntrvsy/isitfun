<script lang="ts">
	import { createProject } from '../../routes/(app)/portal/dashboard/dashboard.remote';

	let { show = $bindable(false), organizationId = '' } = $props();
</script>

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md transition-all duration-300"
	>
		<div
			class="animate-in fade-in zoom-in-95 relative w-full max-w-lg overflow-hidden rounded-3xl border border-purple-200/60 bg-white/95 shadow-2xl backdrop-blur-xl duration-200"
		>
			<header class="flex items-center justify-between border-b border-purple-200/60 p-8">
				<h3 class="font-mono text-2xl font-black tracking-tight text-slate-900">Create New Playtest</h3>
				<button
					onclick={() => (show = false)}
					class="btn btn-circle text-slate-400 btn-ghost btn-sm hover:text-slate-800">✕</button
				>
			</header>

			<form
				{...createProject.enhance(async ({ form, submit }) => {
					try {
						if (await submit()) {
							show = false;
							form.reset();
						}
					} catch (e) {
						console.error(e);
					}
				})}
				class="space-y-6 p-8"
			>
				{#if organizationId}
					<input type="hidden" name="organizationId" value={organizationId} />
				{/if}
				<div class="form-control">
					<label class="label mb-2" for="project-name">
						<span class="label-text font-mono text-xs font-bold tracking-wider text-purple-700 uppercase"
							>Game / Project Name</span
						>
					</label>
					<input
						id="project-name"
						placeholder="e.g. My Amazing Platformer"
						class="input w-full rounded-xl border border-purple-200 bg-white py-6 text-slate-900 placeholder-slate-400 transition-all focus:border-purple-600 focus:outline-none"
						required
						{...createProject.fields.name.as('text')}
					/>
				</div>

				<div class="form-control rounded-2xl border border-purple-200/60 bg-white/80 p-4">
					<label
						class="label flex cursor-pointer items-center justify-between"
						for="password-toggle"
					>
						<div>
							<span class="label-text block font-mono text-sm font-bold text-slate-900">Password Protection</span>
							<span class="mt-1 block text-xs font-medium text-slate-500"
								>Force playtesters to enter a password to play</span
							>
						</div>
						<input
							id="password-toggle"
							class="checkbox checkbox-primary"
							{...createProject.fields.passwordProtected.as('checkbox')}
						/>
					</label>

					{#if createProject.fields.passwordProtected.value()}
						<div
							class="form-control animate-in fade-in mt-4 border-t border-purple-200/60 pt-4 duration-200"
						>
							<label class="label mb-1" for="playtest-password">
								<span class="label-text font-mono text-xs font-bold text-purple-700 uppercase"
									>Access Password</span
								>
							</label>
							<input
								id="playtest-password"
								placeholder="••••••••"
								class="input w-full rounded-xl border border-purple-200 bg-white text-slate-900 placeholder-slate-400 transition-all focus:border-purple-600 focus:outline-none"
								required={createProject.fields.passwordProtected.value()}
								{...createProject.fields.password.as('password')}
							/>
						</div>
					{/if}
				</div>

				<footer class="flex items-center justify-end gap-3 border-t border-purple-200/60 pt-4">
					<button
						type="button"
						onclick={() => (show = false)}
						class="btn rounded-xl text-slate-600 btn-ghost hover:bg-slate-100"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="border border-slate-900 bg-slate-900 px-6 py-3 font-mono text-xs font-bold text-white uppercase transition-all hover:bg-transparent hover:text-slate-900"
					>
						Create Project
					</button>
				</footer>
			</form>
		</div>
	</div>
{/if}

