import { expect } from '@playwright/test';

/** Menu items listed under the Evidence Locker dropdown. */
export const EVIDENCE_LOCKER_ITEMS = [
  'Readiness Dashboard',
  'CQC Domain Overview',
  'Create Inspection',
  'Inspections',
  'AI Recommendations',
];

/**
 * Returns the Evidence Locker dropdown in the navigation.
 * @param {import('@playwright/test').Page} page
 */
export function evidenceLockerDropdown(page) {
  return page.getByRole('button', { name: 'Evidence Locker' });
}

/**
 * Returns a menu item link under the Evidence Locker dropdown.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export function evidenceLockerItem(page, name) {
  return page.getByRole('link', { name, exact: true });
}

/**
 * Opens the Evidence Locker dropdown and checks it is enabled.
 * @param {import('@playwright/test').Page} page
 */
export async function openEvidenceLocker(page) {
  const dropdown = evidenceLockerDropdown(page);
  await expect(dropdown).toBeVisible({ timeout: 30000 });
  await expect(dropdown).toBeEnabled();
  if ((await dropdown.getAttribute('aria-expanded')) !== 'true') {
    await dropdown.click();
  }
}

/**
 * Opens an Evidence Locker menu item and checks that its page loads.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export async function verifyEvidenceLockerItem(page, name) {
  await openEvidenceLocker(page);

  const item = evidenceLockerItem(page, name);
  await expect(item).toBeVisible();
  await expect(item).toBeEnabled();

  await item.click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name, exact: true }).first()).toBeVisible({ timeout: 15000 });
}

/**
 * Returns the value locator of the "Total inspections" card on the Inspections page.
 * @param {import('@playwright/test').Page} page
 */
export function totalInspections(page) {
  return page.getByText('Total inspections', { exact: true }).locator('xpath=following-sibling::p[1]');
}

/**
 * Opens Evidence Locker > Inspections and returns the Total inspections count.
 * @param {import('@playwright/test').Page} page
 */
export async function openInspections(page) {
  await openEvidenceLocker(page);
  await evidenceLockerItem(page, 'Inspections').click();
  await expect(page).toHaveURL(/\/evidence-locker\/inspection-history/);

  // The app caches the list between pages, so reload it from the server
  const listLoaded = page.waitForResponse(r => r.url().includes('/api/evidence-automation/inspections') && r.ok());
  await page.getByRole('button', { name: 'Refresh' }).click();
  await listLoaded;
  await expect(page.getByText(/^\d+ inspections?$/)).toBeVisible({ timeout: 15000 });
  return Number(await totalInspections(page).innerText());
}
