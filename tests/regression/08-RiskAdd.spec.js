import { test, expect } from '@playwright/test';
import { config } from '../../utils/config.js';
import { openRiskSafety, riskSafetyItem } from '../../utils/riskSafety.js';

/**
 * Returns the control right after a form label (the risk form's labels are not linked to their inputs).
 * @param {import('@playwright/test').Page} page
 * @param {string} label
 */
function field(page, label) {
  return page.locator('label').filter({ hasText: new RegExp(`^${label}`) }).locator('xpath=following-sibling::*[1]');
}

test('Risk & Compliance: add a risk', { tag: ['@regression', '@risk-safety'] }, async ({ page }) => {
  test.setTimeout(120000);

  const riskTitle = `Medication error risk ${Date.now()}`;

  await page.goto('/dashboard');

  // Risk & Safety > Risk & Compliance
  await openRiskSafety(page);
  const riskCompliance = riskSafetyItem(page, 'Risk & Compliance');
  await expect(riskCompliance).toBeVisible();
  await riskCompliance.click();

  await expect(page).toHaveURL(/\/risk-compliance$/);
  await expect(page.getByRole('heading', { name: 'Risk & Compliance', exact: true })).toBeVisible({ timeout: 15000 });

  // Add Risk
  await page.getByRole('button', { name: 'Add Risk' }).first().click();
  await expect(page).toHaveURL(/\/risk-compliance\/risk\/new/);
  await expect(page.getByRole('heading', { name: 'Create New Risk Assessment' })).toBeVisible({ timeout: 15000 });

  // Mandatory fields
  await page.getByPlaceholder('e.g., Medication error leading to patient harm').fill(riskTitle);
  await field(page, 'Category').selectOption(config.riskCategory);
  await field(page, 'CQC Pillar').selectOption(config.riskCqcPillar);

  await page.getByRole('combobox').filter({ hasText: 'Select a Owner' }).click();
  await page.getByRole('option', { name: new RegExp(config.riskOwner) }).click();

  await page.getByPlaceholder('Describe the risk in detail...').fill('Repeat prescriptions may be issued without a medication review.');
  await page.getByPlaceholder('Describe what could happen if this risk materializes...').fill('A patient could receive an inappropriate dose and come to harm.');
  await page.getByLabel('Patients').check();
  await page.getByPlaceholder('Describe when and under what circumstances this risk might occur...').fill('During busy periods when repeat requests are processed in bulk.');
  await page.getByPlaceholder('Describe the controls currently in place to mitigate this risk...').fill('Pharmacist reviews a sample of repeat prescriptions each week.');

  // Risk Scoring (5x5 Matrix)
  await field(page, 'Likelihood').fill('3');
  await field(page, 'Impact').fill('4');

  // Create Risk
  const riskSaved = page.waitForResponse(r => r.url().endsWith('/api/risks') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create Risk' }).click();
  const response = await riskSaved;
  expect(response.status(), `POST /api/risks returned ${await response.text()}`).toBeLessThan(400);
  await expect(page).not.toHaveURL(/\/risk-compliance\/risk\/new/, { timeout: 30000 });
  await expect(page.getByText(riskTitle).first()).toBeVisible({ timeout: 15000 });
});
