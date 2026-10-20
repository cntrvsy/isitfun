import { unzip } from 'fflate';

export interface UploadOptions {
	projectId: string;
	isFree: boolean;
	onProgress: (
		progress: number,
		uploadedCount: number,
		totalFiles: number,
		currentFile: string
	) => void;
	onSuccess: (totalFiles: number) => void;
	onError: (errorMsg: string) => void;
}

export class UploadManager {
	private options: UploadOptions;

	constructor(options: UploadOptions) {
		this.options = options;
	}

	async uploadZip(file: File): Promise<void> {
		const { projectId, isFree, onProgress, onSuccess, onError } = this.options;

		// 1. Hard maximum limit for game vertical slices (100MB)
		if (file.size > 100 * 1024 * 1024) {
			onError(
				`File size exceeds maximum 100 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB). isitfun is tailored for web game vertical slices and small playtest builds.`
			);
			return;
		}

		// 2. Free tier size check (40MB)
		if (isFree && file.size > 40 * 1024 * 1024) {
			onError(
				`Free Jammer Tier projects are limited to a maximum ZIP file size of 40 MB. Selected file is ${(
					file.size /
					(1024 * 1024)
				).toFixed(1)} MB. Please upgrade to a Project Pass to upload larger builds.`
			);
			return;
		}

		onProgress(0, 0, 0, 'Reading ZIP file...');

		const reader = new FileReader();

		reader.onerror = () => {
			onError('Failed to read ZIP file.');
		};

		reader.onload = async (e) => {
			const arrayBuffer = e.target?.result as ArrayBuffer;

			unzip(new Uint8Array(arrayBuffer), async (err, unzipped) => {
				if (err) {
					onError('Failed to decompress the ZIP archive.');
					return;
				}

				// Filter out directories and meta files
				const files = Object.entries(unzipped).filter(([name]) => {
					return !name.endsWith('/') && !name.includes('__MACOSX') && !name.startsWith('.');
				});

				// Validate that index.html exists
				const hasIndexHtml = files.some(
					([name]) => name === 'index.html' || name.endsWith('/index.html')
				);
				if (!hasIndexHtml) {
					onError('Missing "index.html" in the root or directories of your ZIP package.');
					return;
				}

				const totalFiles = files.length;
				let uploadedCount = 0;
				let fileIndex = 0;
				let encounteredError = false;

				onProgress(0, 0, totalFiles, 'Initializing versioned build on server...');

				// 1. Initialize atomic build on server
				let buildId: string;
				try {
					const initRes = await fetch(`/v1/projects/${projectId}/builds/init`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ versionString: '1.0.0' })
					});

					if (!initRes.ok) {
						throw new Error(`Server returned ${initRes.status} during build initialization`);
					}
					const initData = (await initRes.json()) as { buildId: string };
					buildId = initData.buildId;
				} catch (initErr) {
					console.error('[UploadManager] Failed to init build:', initErr);
					onError('Failed to initialize game build on server.');
					return;
				}

				onProgress(0, 0, totalFiles, 'Starting chunked upload...');

				// Parallel chunked streaming with concurrency of 3 workers
				const concurrency = 3;

				const uploadWorker = async () => {
					while (fileIndex < files.length && !encounteredError) {
						const currentIdx = fileIndex++;
						if (currentIdx >= files.length) break;
						const [rawPath, dataBytes] = files[currentIdx];

						onProgress(
							Math.round((uploadedCount / totalFiles) * 100),
							uploadedCount,
							totalFiles,
							rawPath
						);

						try {
							const response = await fetch(
								`/v1/projects/${projectId}/builds/${buildId}/upload?path=${encodeURIComponent(rawPath)}`,
								{
									method: 'POST',
									headers: {
										'Content-Type': 'application/octet-stream',
										'Content-Length': String(dataBytes.byteLength)
									},
									body: dataBytes
								}
							);

							if (!response.ok) {
								throw new Error(`Failed with status ${response.status}`);
							}

							uploadedCount++;
							onProgress(
								Math.round((uploadedCount / totalFiles) * 100),
								uploadedCount,
								totalFiles,
								rawPath
							);
						} catch (errorUpload) {
							console.error(errorUpload);
							const msg = errorUpload instanceof Error ? errorUpload.message : String(errorUpload);
							onError(`Failed uploading "${rawPath}": ${msg}`);
							encounteredError = true;
						}
					}
				};

				// Spawn workers
				const workers = [];
				for (let w = 0; w < Math.min(concurrency, files.length); w++) {
					workers.push(uploadWorker());
				}

				await Promise.all(workers);

				if (!encounteredError) {
					onProgress(100, totalFiles, totalFiles, 'Publishing and activating build...');
					try {
						const totalBytes = files.reduce((sum, [, bytes]) => sum + bytes.byteLength, 0);
						const publishRes = await fetch(`/v1/projects/${projectId}/builds/${buildId}/publish`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ totalSizeBytes: totalBytes })
						});

						if (!publishRes.ok) {
							throw new Error(`Server returned ${publishRes.status} during build publication`);
						}

						onSuccess(totalFiles);
					} catch (pubErr) {
						console.error('[UploadManager] Failed to publish build:', pubErr);
						onError('All files uploaded, but failed to activate the build.');
					}
				}
			});
		};

		reader.readAsArrayBuffer(file);
	}
}
