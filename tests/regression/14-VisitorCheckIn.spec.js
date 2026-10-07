import { test, expect } from '@playwright/test';
import { config } from '../../utils/config.js';
import { goToFrontDesk } from '../../utils/frontDesk.js';
import { snap } from '../../utils/report.js';

/**
 * Picks an option in a dropdown inside the check-in dialog.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} dialog
 * @param {string} current text the dropdown shows now
 * @param {string} option
 */
async function choose(page, dialog, current, option) {
  await dialog.getByRole('combobox').filter({ hasText: current }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(dialog.getByRole('combobox').filter({ hasText: option })).toBeVisible();
}

test('Visitor Log: manually check in a visitor', { tag: ['@regression', '@front-desk'] }, async ({ page }) => {
  test.setTimeout(150000);

  // The company carries a unique reference so this run's visitor can be found
  const company = `${config.visitorCompany} ${Date.now()}`;

  // Front Desk > Visitor Log
  await goToFrontDesk(page, 'Visitor Log', /\/visitor-intelligence$/, 'Visitor Log');

  // Manual Check-In
  await page.getByRole('button', { name: 'Manual Check-In' }).click();
  const dialog = page.getByRole('dialog', { name: 'Manual Check-In' });
  await expect(dialog).toBeVisible();

  // Mandatory fields
  await dialog.getByLabel('Full Name').fill(config.visitorName);
  await choose(page, dialog, 'Select visitor type', config.visitorType);
  await dialog.getByLabel('Purpose of Visit').fill(config.visitorPurpose);
  await choose(page, dialog, 'Select area', config.visitorArea);
  await choose(page, dialog, '0 hours', config.visitorDurationHours);
  await choose(page, dialog, '0 min', config.visitorDurationMinutes);
  await dialog.getByLabel('Company / Organisation').fill(company);
  await snap(page, 'Check-in form filled');

  // Check In Visitor
  await dialog.getByRole('button', { name: 'Check In Visitor' }).click();
  await expect(dialog).toBeHidden({ timeout: 30000 });

  // The confirmation gives the new visitor ID, e.g. "Kalyan Reddy checked in: VIS-1E3416F7"
  const confirmation = page.getByText(new RegExp(`${config.visitorName} checked in: VIS-\\w+`));
  await expect(confirmation).toBeVisible({ timeout: 30000 });
  const visitorId = (await confirmation.innerText()).match(/VIS-\w+/)[0];

  // Verify the visitor is listed under Live Visitors as a manual check-in
  const row = page.getByRole('row').filter({ hasText: visitorId });
  await expect(row).toHaveCount(1, { timeout: 30000 });
  await expect(row).toContainText(config.visitorName);
  await expect(row).toContainText(company);
  await expect(row).toContainText(new RegExp(config.visitorType, 'i'));
  await expect(row).toContainText(new RegExp(config.visitorArea, 'i'));
  await expect(row).toContainText('Manual');
  await expect(row.getByRole('button', { name: 'Check Out' })).toBeVisible();
  await snap(page, `Visitor checked in (${visitorId})`);
});
