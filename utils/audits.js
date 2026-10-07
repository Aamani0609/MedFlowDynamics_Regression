import { expect } from '@playwright/test';
import { config } from './config.js';
import { openGovernance, governanceItem } from './governance.js';

/** Returns a date as YYYY-MM-DD for date inputs. */
export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

/** Returns today's date moved by the given number of months. */
export function monthsFromToday(months) {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + months, today.getDate());
}

/**
 * Creates an audit from the configured template and returns its audit ID (e.g. AUD-25F6918A).
 * Leaves the page on the new audit's detail page.
 * @param {import('@playwright/test').Page} page
 */
export async function createAudit(page) {
  const today = new Date();
  const periodFrom = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate() + 1);

  await page.goto('/dashboard');

  // Governance > Audits
  await openGovernance(page);
  const audits = governanceItem(page, 'Audits');
  await expect(audits).toBeVisible();
  await audits.click();

  await expect(page).toHaveURL(/\/audits$/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Audits', exact: true }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Audit Register')).toBeVisible();

  // New Audit > select template
  await page.getByRole('button', { name: 'New Audit' }).first().click();
  await expect(page).toHaveURL(/\/audits\/new/, { timeout: 30000 });
  await expect(page.getByText('Select a Template:')).toBeVisible({ timeout: 15000 });

  await page.getByText(config.auditTemplate, { exact: true }).click();
  await expect(page.getByText(`Using Template: ${config.auditTemplate}`)).toBeVisible();

  // Audit Title, Audit Type and CQC Pillar are set (read-only) by the template
  await expect(page.getByLabel('Audit Title')).toHaveValue(config.auditTemplate);
  await expect(page.getByRole('combobox', { name: 'Audit Type' })).not.toBeEmpty();
  await expect(page.getByLabel('CQC Pillar')).not.toHaveValue('');

  await page.getByRole('combobox').filter({ hasText: 'Select audit lead' }).click();
  await page.getByRole('option', { name: new RegExp(config.auditLead) }).click();

  await page.getByLabel('Period From').fill(isoDate(periodFrom));
  await page.getByLabel('Period To').fill(isoDate(today));

  // Create Audit
  // While an open audit from the same template and lead exists, the app warns "This audit already
  // exists". Its "Create Anyway" button sends the create without allowDuplicate, so the server
  // rejects it (409 DUPLICATE_AUDIT, app bug). The test adds the flag the server asks for.
  await page.route('**/api/audits', async route => {
    const request = route.request();
    if (request.method() !== 'POST') return route.continue();
    await route.continue({ postData: JSON.stringify({ ...request.postDataJSON(), allowDuplicate: true }) });
  });
  await page.getByRole('button', { name: 'Create Audit' }).click();

  const createAnyway = page.getByRole('button', { name: 'Create Anyway' });
  await expect(async () => {
    if (await createAnyway.isVisible()) {
      await createAnyway.click();
    }
    await expect(page).toHaveURL(/\/audits\/AUD-[\w]+$/, { timeout: 5000 });
  }).toPass({ timeout: 60000 });
  await page.unroute('**/api/audits');

  // Every audit from a template shares its title, so the audit ID identifies this one
  const auditId = page.url().split('/').pop();
  await expect(page.getByText(auditId).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: config.auditTemplate, level: 1 })).toBeVisible();

  return auditId;
}

/**
 * Returns the status badge of a step in the Audit Workflow panel.
 * @param {import('@playwright/test').Page} page
 * @param {string} step
 */
export function workflowStep(page, step) {
  // The step label is a paragraph; a button can carry the same text
  return page.locator('p').filter({ hasText: new RegExp(`^${step}$`) }).locator('xpath=following-sibling::*[1]');
}
