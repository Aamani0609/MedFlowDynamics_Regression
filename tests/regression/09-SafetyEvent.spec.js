import { test, expect } from '@playwright/test';
import { config } from '../../utils/config.js';
import { openRiskSafety, riskSafetyItem } from '../../utils/riskSafety.js';
import { pickDateTime } from '../../utils/dateTimePicker.js';

test('Safety Hub: raise a safety event', { tag: ['@regression', '@risk-safety'] }, async ({ page }) => {
  test.setTimeout(120000);

  const incidentTitle = `Wrong dose dispensed ${Date.now()}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await page.goto('/dashboard');

  // Risk & Safety > Safety Hub
  await openRiskSafety(page);
  const safetyHub = riskSafetyItem(page, 'Safety Hub');
  await expect(safetyHub).toBeVisible();
  await safetyHub.click();

  await expect(page).toHaveURL(/\/safety-hub$/);
  await expect(page.getByRole('heading', { name: 'Safety Hub', exact: true })).toBeVisible({ timeout: 15000 });

  // Raise a Safety Event
  await page.getByRole('button', { name: 'Raise a Safety Event' }).first().click();
  await expect(page.getByRole('heading', { name: 'Create Safety Event Report' })).toBeVisible();

  // Step 1: what and when (incidents can't be in the future)
  await page.getByPlaceholder('Brief title of the incident...').fill(incidentTitle);
  await pickDateTime(page, page.getByRole('button', { name: 'dd/mm/yyyy --:-- --' }), yesterday, { hour: '10', minute: '00', period: 'AM' });
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 2: category, event type and severity
  await page.getByRole('combobox').filter({ hasText: 'Select incident category...' }).click();
  await page.getByRole('option', { name: config.safetyEventCategory, exact: true }).click();
  await page.getByRole('combobox').filter({ hasText: 'Select event type...' }).click();
  await page.getByRole('option', { name: config.safetyEventType, exact: true }).click();

  const severity = page.locator('label').filter({ hasText: /^Severity Level/ }).locator('xpath=following-sibling::*[1]');
  await severity.click();
  await page.getByRole('option', { name: config.safetyEventSeverity, exact: true }).click();
  await expect(severity).toHaveText(config.safetyEventSeverity);
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 3: description (minimum 20 characters)
  await page.locator('#ser-description').fill('Patient was dispensed 10mg instead of the prescribed 5mg. The error was spotted at the pharmacy counter before the medicine was taken.');
  await page.locator('#ser-immediate-actions').fill('Correct dose dispensed and the patient informed.');

  // Raise Safety Event
  await page.getByRole('button', { name: 'Raise Safety Event', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create Safety Event Report' })).toBeHidden({ timeout: 30000 });
  await expect(page.getByText(incidentTitle).first()).toBeVisible({ timeout: 15000 });
});
