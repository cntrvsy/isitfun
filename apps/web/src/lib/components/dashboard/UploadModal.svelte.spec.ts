import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import UploadModal from './UploadModal.svelte';

describe('UploadModal.svelte', () => {
	it('renders upload dropzone correctly', async () => {
		render(UploadModal, {
			show: true,
			projectId: 'proj_test_123',
			isFree: true
		});

		const heading = page.getByRole('heading', { level: 3 });
		await expect.element(heading).toBeInTheDocument();
		await expect.element(heading).toHaveTextContent('Upload HTML5 Export');
	});
});
