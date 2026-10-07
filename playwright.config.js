// @ts-check
import { defineConfig, devices } from '@playwright/test';
import { config } from './utils/config.js';
import { maximizedViewport } from './utils/screen.js';

/* Every browser window opens filling the screen (Firefox has no "start maximized" option) */
const maximized = maximizedViewport();

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Regression suite (tests/regression): one functionality per file, one test per file. Runs in the Medflow
     Dynamics menu order, one test at a time, files by their number (01-Login ... 21-ScheduleRota).
     Use `npm run test:parallel` for a faster, parallel run. */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* One test at a time, so they run in order */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  /* open: 'never' stops failed runs from holding port 9323; view it with `npm run report` */
  reporter: [
    ['html', { open: 'never' }],
    /* One-page HTML report with charts and screenshots: test-report/report.html (open it with `npm run report:summary`) */
    ['./scripts/summaryReporter.js', { outputFolder: 'test-report', author: config.reportAuthor }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: config.baseUrl,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take a full-page screenshot at the end of every test and attach it to the reports */
    screenshot: { mode: 'on', fullPage: true },

    /* Wait 1 second between each browser action (click, fill, goto, ...) */
    launchOptions: { slowMo: 1000 },
  },

  /* Configure projects for major browsers */
  projects: [
  /* {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },*/

    // Runs 01-Login.spec.js first and saves the signed-in session
    {
      name: 'login',
      testMatch: /Login\.spec\.js/,
      use: { ...devices['Desktop Firefox'], viewport: maximized },
    },

    // All other specs start already signed in
    {
      name: 'firefox',
      testIgnore: /Login\.spec\.js/,
      dependencies: ['login'],
      use: { ...devices['Desktop Firefox'], viewport: maximized, storageState: 'playwright/.auth/user.json' },
    },


    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});

