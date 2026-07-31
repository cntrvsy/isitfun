import { expect, test } from '@playwright/test';

test.describe('Platform E2E Smoke Test Suite', () => {
	test('landing page renders correctly with hero branding', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(/Is It Fun\?/i);
		await expect(page.locator('h1')).toBeVisible();
	});

	test('auth login page is accessible', async ({ page }) => {
		await page.goto('/auth');
		await expect(page.locator('body')).toBeVisible();
	});

});
