<script lang="ts">
	import { UploadManager } from '#lib/client/uploader.js';
	import { X, UploadCloud, CheckCircle2, AlertCircle, Copy, Check } from '@lucide/svelte';

	let {
		show = $bindable(false),
		projectId,
		isFree
	} = $props<{
		show: boolean;
		projectId: string;
		isFree: boolean;
	}>();

	let isUploading = $state(false);
	let uploadProgress = $state(0);
	let uploadedCount = $state(0);
	let totalFiles = $state(0);
	let currentUploadingFile = $state('');
	let uploadError = $state('');
	let isUploadSuccess = $state(false);
	let isCopied = $state(false);

	async function handleZipUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		isUploading = true;
		uploadProgress = 0;
		uploadedCount = 0;
		totalFiles = 0;
		currentUploadingFile = 'Reading ZIP archive...';
		uploadError = '';
		isUploadSuccess = false;

		const uploader = new UploadManager({
			projectId,
			isFree,
			onProgress: (progress, count, total, currentFile) => {
				uploadProgress = progress;
				uploadedCount = count;
				totalFiles = total;
				currentUploadingFile = currentFile;
			},
			onSuccess: (total) => {
				totalFiles = total;
				isUploadSuccess = true;
				isUploading = false;
			},
			onError: (err) => {
				uploadError = err;
				isUploading = false;
			}
		});

		try {
			await uploader.uploadZip(file);
		} catch (err) {
			uploadError = err instanceof Error ? err.message : String(err);
			isUploading = false;
		}
	}

	function handleCopy() {
		const playUrl = `${window.location.origin}/play/${projectId}`;
		navigator.clipboard.writeText(playUrl).then(() => {
			isCopied = true;
			setTimeout(() => {
				isCopied = false;
			}, 2000);
		});
	}

	function handleClose() {
		show = false;
		isUploading = false;
		uploadProgress = 0;
		uploadedCount = 0;
		totalFiles = 0;
		currentUploadingFile = '';
		uploadError = '';
		isUploadSuccess = false;
		isCopied = false;
	}
</script>

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
	>
		<div
			class="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
		>
			<header class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
				<div>
					<h3 class="text-lg font-bold tracking-tight text-slate-900">Upload HTML5 Export</h3>
					<span class="text-xs text-slate-500">
						HTML5 / WebGL ZIP archive deployment
					</span>
				</div>
				<button
					onclick={handleClose}
					class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					aria-label="Close modal"
				>
					<X class="h-4 w-4" />
				</button>
			</header>

			<div class="p-6">
				{#if !isUploading && !isUploadSuccess}
					<!-- Dropzone -->
					<div
						class="group relative rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center transition-all hover:border-purple-500 hover:bg-white"
					>
						<input
							type="file"
							accept=".zip"
							onchange={handleZipUpload}
							class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
							aria-label="Upload ZIP archive"
						/>
						<UploadCloud class="mx-auto h-10 w-10 text-slate-400 transition-colors group-hover:text-purple-600" />
						<p class="mt-3 text-xs font-bold text-slate-900">
							Drag and drop your game ZIP archive here
						</p>
						<p class="mt-1 text-[11px] text-slate-500">
							Must contain index.html and assets ({isFree ? 'max 40MB per build on Free tier' : 'max 250MB per build on Pro tier'})
						</p>
					</div>
				{:else if isUploading}
					<!-- Upload Progress -->
					<div class="space-y-4 py-2">
						<div class="flex items-center justify-between text-xs font-semibold text-slate-700">
							<span>Uploading assets to edge...</span>
							<span class="font-mono">{uploadProgress}%</span>
						</div>
						<div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
							<div
								class="h-full rounded-full bg-purple-600 transition-all duration-300"
								style="width: {uploadProgress}%"
							></div>
						</div>
						<p class="font-mono text-[11px] text-slate-500 truncate">
							{currentUploadingFile || 'Processing files...'}
						</p>
					</div>
				{:else if isUploadSuccess}
					<!-- Success State -->
					<div class="space-y-4 text-center py-2">
						<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-50 text-emerald-600">
							<CheckCircle2 class="h-6 w-6" />
						</div>
						<div>
							<h4 class="text-base font-bold text-slate-900">Upload Complete</h4>
							<p class="mt-1 text-xs text-slate-500">
								Extracted and deployed {totalFiles} files to Cloudflare edge storage.
							</p>
						</div>

						<div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-left">
							<input
								type="text"
								readonly
								value={`${typeof window !== 'undefined' ? window.location.origin : ''}/play/${projectId}`}
								class="w-full bg-transparent font-mono text-xs text-slate-700 focus:outline-none"
							/>
							<button
								onclick={handleCopy}
								class="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
							>
								{#if isCopied}
									<Check class="h-3.5 w-3.5 text-emerald-600" /> Copied
								{:else}
									<Copy class="h-3.5 w-3.5" /> Copy
								{/if}
							</button>
						</div>
					</div>
				{/if}

				{#if uploadError}
					<div class="mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
						<AlertCircle class="h-4 w-4 shrink-0 text-rose-500" />
						<span>{uploadError}</span>
					</div>
				{/if}
			</div>

			<footer class="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
				<button
					type="button"
					onclick={handleClose}
					class="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
				>
					{isUploadSuccess ? 'Done' : 'Cancel'}
				</button>
			</footer>
		</div>
	</div>
{/if}
