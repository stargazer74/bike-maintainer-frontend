import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

/**
 * Cucumber scenarios (e2e/features) run in a real browser against `ng serve`; the backend is replaced by the
 * in-memory FakeBackend (e2e/support), so no backend, database or network is needed. playwright-bdd turns the
 * features into Playwright tests in e2e/.features-gen before each run (`npm run e2e`).
 */
const testDir = defineBddConfig({
  features: 'e2e/features/*.feature',
  steps: ['e2e/steps/*.ts', 'e2e/support/fixtures.ts'],
  outputDir: 'e2e/.features-gen',
});

const PORT = 4300;
const isCi = !!process.env['CI'];

export default defineConfig({
  testDir,
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // German UI: the language a browser without stored choice starts in.
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Own port, so a running `npm start` on 4200 is not used by accident.
    command: `npx ng serve --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCi,
    timeout: 180_000,
  },
});
