import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry'
	},
	webServer: [
		{
			command: 'npm run dev',
			cwd: '../api',
			url: 'http://localhost:8787/v1/health',
			reuseExistingServer: false,
			timeout: 60000
		},
		{
			command: 'npm run dev',
			cwd: '.',
			url: 'http://localhost:5173',
			reuseExistingServer: false,
			timeout: 60000
		}
	],
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
