<script lang="ts">
	import { UploadManager } from '#lib/client/uploader.js';

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
		currentUploadingFile = 'Reading ZIP file...';
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
		// Reset state
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
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md transition-all duration-300"
	>
		<div
			class="animate-in fade-in zoom-in-95 relative w-full max-w-lg overflow-hidden rounded-3xl border border-purple-200/60 bg-white/95 shadow-2xl backdrop-blur-xl duration-200"
		>
			<header class="flex items-center justify-between border-b border-purple-200/60 p-8">
				<div>
					<h3 class="font-mono text-2xl font-black text-slate-900">Upload HTML5 Export</h3>
					<span class="mt-1 block font-mono text-xs font-bold text-purple-700 uppercase"
						>Parallel browser decompress & edge streaming</span
					>
				</div>
				{#if !isUploading}
					<button
						onclick={handleClose}
						class="btn btn-circle text-slate-400 btn-ghost btn-sm hover:text-slate-800">✕</button
					>
				{/if}
			</header>

			<div class="space-y-6 p-8">
				{#if !isUploading && !isUploadSuccess && !uploadError}
					<!-- Dropzone -->
					<div
						class="group relative rounded-2xl border-2 border-dashed border-purple-200/80 bg-purple-50/40 px-6 py-12 text-center transition-all hover:border-purple-500 hover:bg-white"
					>
						<input
							type="file"
							accept=".zip"
							onchange={handleZipUpload}
							class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
							aria-label="Upload ZIP archive"
						/>
						<div class="mb-4 text-4xl transition-transform group-hover:scale-110">📦</div>
						<p class="mb-1 font-mono text-sm font-bold text-slate-900 uppercase">
							Drag and drop your game ZIP archive here
						</p>
						<p class="text-xs font-medium text-slate-500">
							Contains index.html, JS, and asset binaries (max 100MB)
						</p>
					</div>
				{:else if isUploading}
					<!-- Upload Progress UI -->
					<div class="space-y-4 py-4">
						<div class="flex items-center justify-between font-mono text-xs font-bold">
							<span class="text-purple-700 uppercase">Processing & Uploading Edge Assets...</span>
							<span class="text-slate-700">{uploadProgress}%</span>
						</div>

						<!-- Progress bar -->
						<div
							class="h-3 w-full overflow-hidden rounded-full border border-purple-200 bg-purple-100/60"
						>
							<div
								class="h-full rounded-full bg-slate-900 transition-all duration-300"
								style="width: {uploadProgress}%"
							></div>
						</div>

						<div class="mt-2 flex items-center justify-between font-mono text-xs text-slate-600">
							<span class="max-w-[320px] truncate font-mono">
								📄 {currentUploadingFile}
							</span>
							<span class="shrink-0 font-bold">
								{uploadedCount} / {totalFiles} Files
							</span>
						</div>

						<div
							class="animate-pulse space-y-1 rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-200 shadow-inner"
						>
							<div>$ client: unzip zipBytes</div>
							<div>$ stream: put R2 games/{projectId}/assets/...</div>
						</div>
					</div>
				{:else if isUploadSuccess}
					<!-- Upload Success Screen -->
					<div class="space-y-4 py-8 text-center">
						<div
							class="mx-auto flex h-16 w-16 animate-bounce items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 text-3xl text-emerald-700 shadow-sm"
						>
							✓
						</div>
						<h4 class="font-mono text-xl font-bold text-emerald-800 uppercase">Upload Complete!</h4>
						<p class="mx-auto max-w-sm text-xs font-medium text-slate-600">
							Your game ZIP was successfully unzipped client-side and all {totalFiles} assets are loaded
							in the R2 edge storage bucket!
						</p>

						<div class="flex justify-center gap-3 border-t border-purple-200/60 pt-6">
							<button
								onclick={handleClose}
								class="btn rounded-xl border border-slate-900 bg-white font-mono text-xs font-bold text-slate-900 uppercase hover:bg-slate-100"
							>
								Close
							</button>
							<button
								onclick={handleCopy}
								class="border border-slate-900 bg-slate-900 px-6 py-3 font-mono text-xs font-bold text-white uppercase transition-all hover:bg-transparent hover:text-slate-900"
							>
								{#if isCopied}
									✨ Copied!
								{:else}
									Copy Play URL
								{/if}
							</button>
						</div>
					</div>
				{:else if uploadError}
					<!-- Error Screen -->
					<div class="space-y-4 py-6 text-center">
						<div
							class="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-rose-300 bg-rose-100 text-3xl text-rose-700"
						>
							⚠️
						</div>
						<h4 class="font-mono text-xl font-bold text-rose-800 uppercase">Failed to Upload</h4>
						<p class="mx-auto max-w-md text-xs font-medium text-slate-600">{uploadError}</p>

						<div class="border-t border-purple-200/60 pt-6">
							<button
								onclick={() => {
									uploadError = '';
									isUploading = false;
									isUploadSuccess = false;
								}}
								class="border border-slate-900 bg-slate-900 px-6 py-3 font-mono text-xs font-bold text-white uppercase hover:bg-transparent hover:text-slate-900"
							>
								Try Again
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
