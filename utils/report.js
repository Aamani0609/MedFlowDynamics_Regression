import { test } from '@playwright/test';

/**
 * Takes a full-page screenshot and attaches it to the current test, so it shows in the reports.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export async function snap(page, name) {
  await test.info().attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}
