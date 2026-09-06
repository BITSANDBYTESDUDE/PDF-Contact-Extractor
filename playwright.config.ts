import { defineConfig, devices } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';

let launchOptions = {};
if (process.env.USE_BUNDLED_CHROMIUM === '1') {
  const { default: chromium, inflate, setupLambdaEnvironment } = await import('@sparticuz/chromium');
  const require = createRequire(import.meta.url);
  const library = path.dirname(require.resolve('@sparticuz/chromium'));
  const runtime = await inflate(path.join(library, '../bin/al2023.tar.br'));
  setupLambdaEnvironment(path.join(runtime, 'lib'));
  launchOptions = {
    executablePath: await chromium.executablePath(),
    args: chromium.args.filter((arg) => !['--disable-web-security', '--single-process'].includes(arg)),
  };
}
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions,
  },
  webServer: process.env.CI
    ? {
        command: 'npm start',
        url: 'http://localhost:3000/api/health',
        timeout: 60000,
        reuseExistingServer: false,
      }
    : undefined,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
