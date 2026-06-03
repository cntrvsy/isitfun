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

	it('toggles password protection input field visibility', async () => {
		render(CreateProjectModal, { show: true });

		const checkbox = page.getByRole('checkbox');
		await expect.element(checkbox).toBeInTheDocument();

		// Password field should not be visible initially
		const passwordInputInitial = page.getByPlaceholder('••••••••');
		await expect.element(passwordInputInitial).not.toBeInTheDocument();

		// Click the checkbox to toggle it on
		await checkbox.click();

		// Password field should now be in the document
		const passwordInputAfter = page.getByPlaceholder('••••••••');
		await expect.element(passwordInputAfter).toBeInTheDocument();
	});
});
