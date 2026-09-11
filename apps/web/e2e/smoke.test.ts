import { expect, test } from '@playwright/test';

test.describe('Platform E2E Smoke Test Suite', () => {
	test('landing page renders correctly with hero branding', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(/Is It Fun\?/i);
		await expect(page.locator('h1')).toBeVisible();
	});

	test('auth login page renders login inputs and forms', async ({ page }) => {
		await page.goto('/auth');
		await expect(page.locator('body')).toBeVisible();
		await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
	});

	test('gateway reverse proxy forwards /v1/health to Hono API', async ({ request }) => {
		const response = await request.get('/v1/health');
		expect(response.ok()).toBeTruthy();
		const data = (await response.json()) as { status: string; timestamp: number };
		expect(data.status).toBe('ok');
		expect(data.timestamp).toBeDefined();
	});

	test('playgame route renders safely with project query', async ({ page }) => {
		await page.goto('/playgame?project=demo');
		await expect(page.locator('body')).toBeVisible();
	});
});
