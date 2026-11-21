import { defineConfig, devices } from '@playwright/test';

const PRODUCTION_BASE_URL = 'http://localhost:4173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /production.*\.spec\.ts/,
    },
    {
      name: 'chromium-production',
      testMatch: /production.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: PRODUCTION_BASE_URL },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      // Rebuild on every run so the iframe srcDoc comes from the real production
      // bundle, where the bundled axe source previously broke the sandbox script.
      command: 'npm run build && npm run preview -- --port 4173 --strictPort',
      url: PRODUCTION_BASE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
