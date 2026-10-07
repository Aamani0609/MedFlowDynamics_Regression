import { expect } from '@playwright/test';
import { config } from './config.js';
import { pickDate } from './dateTimePicker.js';
import { snap } from './report.js';

/**
 * Returns the Daily Operations dropdown in the navigation.
 * @param {import('@playwright/test').Page} page
 */
export function dailyOperationsDropdown(page) {
  return page.getByRole('button', { name: 'Daily Operations', exact: true });
}

/**
 * Returns a menu item link under the Daily Operations dropdown.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export function dailyOperationsItem(page, name) {
  // Sidebar link only, so the breadcrumb link with the same name is ignored
  return page.getByRole('link', { name, exact: true }).and(page.locator('[data-sidebar="menu-sub-button"]'));
}

/**
 * Opens the Daily Operations dropdown and checks it is enabled.
 * @param {import('@playwright/test').Page} page
 */
export async function openDailyOperations(page) {
  const dropdown = dailyOperationsDropdown(page);
  await expect(dropdown).toBeVisible({ timeout: 45000 });
  await expect(dropdown).toBeEnabled();
  if ((await dropdown.getAttribute('aria-expanded')) !== 'true') {
    await dropdown.click();
  }
}

/**
 * Opens a Daily Operations page from the sidebar and checks its heading.
 * @param {import('@playwright/test').Page} page
 * @param {string} item sidebar link name
 * @param {RegExp} url expected URL
 * @param {string} heading page heading
 */
export async function goToDailyOperation(page, item, url, heading) {
  await page.goto('/dashboard');
  await openDailyOperations(page);
  const link = dailyOperationsItem(page, item);
  await expect(link).toBeVisible();
  await link.click();

  // The dev site can take 20-30s to switch pages
  await expect(page).toHaveURL(url, { timeout: 45000 });
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 30000 });
}

/**
 * Selects a staff member in a searchable "Assigned To" combobox.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} scope dialog or form holding the combobox
 * @param {string} placeholder
 * @param {string} name
 */
export async function selectStaff(page, scope, placeholder, name) {
  await scope.getByRole('combobox').filter({ hasText: placeholder }).click();
  const option = page.getByRole('option', { name: new RegExp(name) }).first();
  await expect(option).toBeVisible();

  // Long staff lists scroll under the mouse. Searchable pickers are narrowed by typing the name;
  // plain lists get the option focused and chosen with Enter.
  const search = page.locator('[data-radix-popper-content-wrapper]').last().getByPlaceholder(/^Search/);
  if (await search.isVisible()) {
    await search.fill(name);
    await option.click();
  } else {
    await option.focus();
    await page.keyboard.press('Enter');
  }
  await expect(scope.getByRole('combobox').filter({ hasText: name })).toBeVisible();
}

/**
 * Creates a checklist template (premises or equipment) and schedules an inspection from it.
 * @param {import('@playwright/test').Page} page
 * @param {{ kind: 'Premises Checklist' | 'Equipment Inspection', createButton: string, dialogName: string, type: string, check: string, checkCategory: string }} options
 */
export async function createTemplateAndSchedule(page, options) {
  const templateName = `${options.type} check ${Date.now()}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  await goToDailyOperation(page, 'Premises & Equipment', /\/premises-checklists$/, 'Premises Checklist & Equipment Inspection');

  // Create template - step 1: template info
  await page.getByRole('button', { name: options.createButton }).click();
  const templateDialog = page.getByRole('dialog', { name: options.dialogName });
  await expect(templateDialog).toBeVisible();
  await templateDialog.getByLabel('Template Name').fill(templateName);
  await templateDialog.getByRole('combobox').click();
  await page.getByRole('option', { name: options.type, exact: true }).click();
  await expect(templateDialog.getByRole('combobox')).toHaveText(options.type);
  await templateDialog.getByRole('button', { name: 'Next: Checklist Items →' }).click();

  // Step 2: at least one checklist item
  await templateDialog.getByPlaceholder('e.g. Is the fire extinguisher in date and accessible?').fill(options.check);
  await templateDialog.getByRole('combobox').filter({ hasText: 'Select category…' }).click();
  await page.getByRole('option', { name: options.checkCategory, exact: true }).click();
  await templateDialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(templateDialog.getByText(options.check, { exact: true })).toBeVisible();
  await snap(page, `${options.kind} template filled`);
  await templateDialog.getByRole('button', { name: 'Create Template' }).click();
  await expect(templateDialog).toBeHidden({ timeout: 45000 });

  // New Schedule from the template (it is listed under My Templates)
  await page.getByRole('button', { name: 'New Schedule' }).click();
  const scheduleDialog = page.getByRole('dialog', { name: 'New Inspection Schedule' });
  await expect(scheduleDialog).toBeVisible();
  await scheduleDialog.getByRole('button', { name: options.kind, exact: true }).click();
  const template = scheduleDialog.getByRole('button', { name: new RegExp(templateName) });
  await expect(template).toBeVisible({ timeout: 15000 });
  await template.click();

  // Step 2: schedule details (the name comes from the template)
  await expect(scheduleDialog.getByText(`Using: ${templateName}`)).toBeVisible();
  await expect(scheduleDialog.getByLabel('Schedule Name')).toHaveValue(templateName);
  if (options.kind === 'Equipment Inspection') {
    // Equipment lists the items of the template's equipment type
    await scheduleDialog.getByRole('combobox').filter({ hasText: 'Select Equipment' }).click();
    await page.getByRole('option', { name: config.equipmentItem, exact: true }).click();
  } else {
    await scheduleDialog.getByRole('combobox').filter({ hasText: 'Select Area / Zone' }).click();
    await page.getByRole('option', { name: config.inspectionArea, exact: true }).click();
  }
  // "Location" for premises, "Location / Storage Area" for equipment
  await scheduleDialog.getByLabel('Location').fill(config.inspectionLocation);
  await scheduleDialog.getByRole('combobox').filter({ hasText: /^(Daily|Weekly|Fortnightly|Monthly|Quarterly|Annually)$/ }).click();
  await page.getByRole('option', { name: config.inspectionFrequency, exact: true }).click();
  await pickDate(page, scheduleDialog.getByRole('button', { name: 'Select first due date' }), tomorrow);
  await selectStaff(page, scheduleDialog, 'Select staff member...', config.inspectionAssignee);
  await snap(page, `${options.kind} schedule filled`);
  await scheduleDialog.getByRole('button', { name: 'Create Schedule' }).click();
  await expect(scheduleDialog).toBeHidden({ timeout: 45000 });

  // Verify the schedule is in the Schedule Register under its tab
  await page.getByRole('tab', { name: options.kind }).click();
  const row = page.getByRole('row').filter({ hasText: templateName });
  await expect(row).toHaveCount(1, { timeout: 30000 });
  await expect(row).toContainText(config.inspectionFrequency);
}
