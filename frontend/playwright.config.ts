import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

// E2E tests run against the production build served by `vite preview`, on the mock data source (fixed clock,
// spec D1). The backend is never started: a test that needs `/api/*` mocks it with `page.route`.
//
// Screenshot baselines (`e2e/__screenshots__/`) are Linux renders made in the official Playwright Docker image,
// like CI (ubuntu-latest); the `@visual` tests skip themselves on other platforms. See frontend/README.md.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // One baseline per test file and name, without a platform suffix: only Linux baselines exist.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      // Small anti-aliasing differences between machines are tolerated, layout changes are not.
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    viewport: { width: 1400, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
