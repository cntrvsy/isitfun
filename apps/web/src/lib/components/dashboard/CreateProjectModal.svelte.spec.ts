import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CreateProjectModal from './CreateProjectModal.svelte';

describe('CreateProjectModal.svelte', () => {
	it('renders modal when show is true', async () => {
		render(CreateProjectModal, { show: true });

		const heading = page.getByRole('heading', { level: 3 });
		await expect.element(heading).toBeInTheDocument();
		await expect.element(heading).toHaveTextContent('Create New Playtest');
	});

	it('renders project name input and access key protection info', async () => {
		render(CreateProjectModal, { show: true });

		const input = page.getByPlaceholder('e.g. My Amazing Platformer');
		await expect.element(input).toBeInTheDocument();

		const bannerHeading = page.getByText('Access Key Protection');
		await expect.element(bannerHeading).toBeInTheDocument();
	});
});
