<script lang="ts">
	import { refreshAll } from '$app/navigation';
	import { createOrganization } from '../../../routes/(app)/portal/dashboard/dashboard.remote';
	import { X } from '@lucide/svelte';

	interface Props {
		show: boolean;
		onClose: () => void;
		onCreated: (orgId: string) => void;
	}

	let { show, onClose, onCreated }: Props = $props();
	let orgNameInput = $state('');
</script>

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
	>
		<div
			class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
		>
			<header class="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
				<h3 class="text-lg font-bold tracking-tight text-slate-900">Create Team Workspace</h3>
				<button
					onclick={onClose}
					class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					aria-label="Close modal"
				>
					<X class="h-4 w-4" />
				</button>
			</header>
			<form
				{...createOrganization.enhance(async ({ submit }: any) => {
					if (await submit()) {
						const res = createOrganization.result;
						if (res && typeof res === 'object' && 'organizationId' in res && res.organizationId) {
							onCreated(String(res.organizationId));
						}
						orgNameInput = '';
						onClose();
						await refreshAll();
					}
				})}
				class="space-y-4"
			>
				<div>
					<label class="mb-1.5 block text-xs font-semibold text-slate-700" for="org-name-input">
						Team / Studio Name
					</label>
					<input
						id="org-name-input"
						placeholder="e.g. Pixel Arts Studio"
						class="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-purple-600 focus:outline-none"
						required
						bind:value={orgNameInput}
						{...createOrganization.fields.name.as('text')}
					/>
				</div>
				<div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
					<button
						type="button"
						onclick={onClose}
						class="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
					>
						Create Team
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
