import { defineConfig } from '@playwright/test';

declare const process: {
  env: { PLAYWRIGHT_CHROMIUM_EXECUTABLE?: string; PLAYWRIGHT_SOFTWARE_RENDERER?: string };
};

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5187',
    viewport: { width: 1280, height: 800 },
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      chromiumSandbox: false,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--enable-unsafe-swiftshader',
        ...(process.env.PLAYWRIGHT_SOFTWARE_RENDERER === '1'
          ? ['--use-angle=swiftshader', '--use-gl=angle']
          : []),
      ],
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5187 --strictPort',
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
