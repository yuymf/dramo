import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Dramo E2E tests
 * - Frontend: http://localhost:12323
 * - Backend API: http://localhost:12321
 * - AgentOS: http://localhost:12322
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false, // Sequential to avoid conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: 'html',
  timeout: 150000, // 2.5 minutes for complete E2E with backend processing
  expect: {
    timeout: 5000,
  },

  use: {
    baseURL: 'http://localhost:12323',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:12323',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
