import { test, expect } from '@playwright/test';
import { config } from '../../utils/config.js';
import { snap } from '../../utils/report.js';

/**
 * Picks an option in a dropdown. Long lists scroll under the mouse, so the option is focused and chosen with Enter.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} combobox
 * @param {string | RegExp} name
 */
async function choose(page, combobox, name) {
  await combobox.click();
  const option = page.getByRole('option', typeof name === 'string' ? { name, exact: true } : { name });
  await option.first().focus();
  await page.keyboard.press('Enter');
}

/**
 * Opens Staff Management > Add Staff and returns the wizard.
 * @param {import('@playwright/test').Page} page
 */
async function openAddStaff(page) {
  await page.goto('/dashboard');
  const staffManagement = page.getByRole('link', { name: 'Staff Management', exact: true });
  await expect(staffManagement).toBeVisible({ timeout: 45000 });
  await staffManagement.click();
  await expect(page).toHaveURL(/\/staff$/, { timeout: 45000 });
  await expect(page.getByRole('heading', { name: 'Staff & Training Hub' })).toBeVisible({ timeout: 30000 });

  await page.getByRole('button', { name: 'Add Staff' }).click();
  const wizard = page.locator('div')
    .filter({ has: page.getByRole('heading', { name: 'Add New Staff Member' }) })
    .filter({ has: page.getByRole('button', { name: 'Cancel' }) })
    .last();
  await expect(wizard.getByText('Step 1 of 3')).toBeVisible();
  return wizard;
}

test('Staff Management: add a staff member as Nurse', { tag: ['@regression', '@staff'] }, async ({ page }) => {
  test.setTimeout(180000);

  const role = 'Nurse';
  const [firstName, ...rest] = config.staffNurseName.split(/\s+/);
  const lastName = rest.join(' ');
  const fullName = `${firstName} ${lastName}`;
  // A unique email per run, so the same person can be added again; example.com never receives mail
  const email = `${firstName}.${lastName}.${Date.now()}@example.com`.toLowerCase().replace(/\s+/g, '.');

  const wizard = await openAddStaff(page);

  // Step 1: Identity & Role
  await wizard.getByPlaceholder('e.g., Sarah').first().fill(firstName);
  await wizard.getByPlaceholder('e.g., Chen').fill(lastName);
  await choose(page, wizard.getByRole('combobox').filter({ hasText: 'Select a job role' }), role);
  await expect(wizard.getByRole('combobox').filter({ hasText: role })).toBeVisible();
  await snap(page, 'Identity and role');
  await wizard.getByRole('button', { name: 'Next' }).click();

  // Step 2: Employment Details (start date, work pattern and hours have defaults)
  await expect(wizard.getByText('Step 2 of 3')).toBeVisible();
  await choose(page, wizard.getByRole('combobox').filter({ hasText: 'Select document type' }), config.staffRightToWork);
  await choose(page, wizard.getByRole('combobox').filter({ hasText: 'Select probation manager' }), new RegExp(config.staffProbationManager));
  await snap(page, 'Employment details');
  await wizard.getByRole('button', { name: 'Next' }).click();

  // Step 3: Contact Information
  await expect(wizard.getByText('Step 3 of 3')).toBeVisible();
  await wizard.getByPlaceholder('firstname.lastname@oakleysurgery.nhs.uk').fill(email);
  await snap(page, 'Contact information');

  // Create Staff Member - check the server's answer so a rejection shows its reason
  const saved = page.waitForResponse(r => r.url().includes('/api/staff/addStaff') && r.request().method() === 'POST');
  await wizard.getByRole('button', { name: 'Create Staff Member' }).click();
  const response = await saved;
  expect(response.status(), `Add staff returned ${await response.text()}`).toBe(201);
  await expect(page.getByRole('heading', { name: 'Add New Staff Member' })).toBeHidden({ timeout: 30000 });

  // Verify the staff member is listed with the role
  await page.getByPlaceholder('Search staff by name or email...').fill(email);
  const row = page.getByRole('row').filter({ hasText: email });
  await expect(row).toHaveCount(1, { timeout: 30000 });
  await expect(row).toContainText(fullName);
  await expect(row).toContainText(role);
  await expect(row).toContainText('Active');
});
