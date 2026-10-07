import { expect } from '@playwright/test';

/**
 * Opens a Front Desk page from the sidebar (Visitor Log, Patient Voice) and checks its heading.
 * @param {import('@playwright/test').Page} page
 * @param {string} item sidebar link name
 * @param {RegExp} url expected URL
 * @param {string} heading page heading
 */
export async function goToFrontDesk(page, item, url, heading) {
  await page.goto('/dashboard');
  const frontDesk = page.getByRole('button', { name: 'Front Desk', exact: true });
  await expect(frontDesk).toBeVisible({ timeout: 45000 });
  if ((await frontDesk.getAttribute('aria-expanded')) !== 'true') {
    await frontDesk.click();
  }
  // Sidebar link only, so the breadcrumb link with the same name is ignored
  await page.getByRole('link', { name: item, exact: true }).and(page.locator('[data-sidebar="menu-sub-button"]')).click();
  await expect(page).toHaveURL(url, { timeout: 45000 });
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 30000 });
}

/**
 * Opens Front Desk > Patient Voice, selects a tab and returns its panel.
 * @param {import('@playwright/test').Page} page
 * @param {'Dashboard' | 'Inbox' | 'You Said, We Did' | 'QR Settings'} tabName
 */
export async function openPatientVoiceTab(page, tabName) {
  await goToFrontDesk(page, 'Patient Voice', /\/patient-voice$/, 'Patient Voice Loop');
  await expect(page.getByRole('tablist', { name: 'Patient Voice tabs' })).toBeVisible();

  const tab = page.getByRole('tab', { name: tabName, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  const panel = page.getByRole('tabpanel', { name: tabName });
  await expect(panel).toBeVisible();
  return panel;
}
