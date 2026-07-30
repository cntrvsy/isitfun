import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import UploadModal from './UploadModal.svelte';

describe('UploadModal.svelte', () => {
	it('renders dropzone when show is true', async () => {
		render(UploadModal, { show: true, projectId: 'proj_1', isFree: true });

		const heading = page.getByRole('heading', { level: 3 });
		await expect.element(heading).toBeInTheDocument();
		await expect.element(heading).toHaveTextContent('Upload HTML5 Export');

		const dropzone = page.getByText('Drag and drop your game ZIP archive here');
		await expect.element(dropzone).toBeInTheDocument();
	});
});
