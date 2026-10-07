import { test, expect } from '@playwright/test';
import { config } from '../../utils/config.js';
import { goToDailyOperation, selectStaff } from '../../utils/dailyOperations.js';
import { snap } from '../../utils/report.js';

test('Drug & Consumable: add an item', { tag: ['@regression', '@daily-operations'] }, async ({ page }) => {
  test.setTimeout(180000);

  const itemName = `Paracetamol 500mg Tablets ${Date.now()}`;

  await goToDailyOperation(page, 'Drug & Consumable', /\/drug-consumable$/, 'Drug & Consumable Monitoring');

  // Add Item (the form opens in a modal)
  await page.getByRole('button', { name: 'Add Item' }).first().click();
  const form = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Add New Item' }) }).filter({ has: page.locator('#item-name') }).last();
  await expect(form).toBeVisible();

  // Mandatory fields
  await form.locator('#item-name').fill(itemName);
  await form.locator('#item-category').click();
  await page.getByRole('option', { name: config.drugCategory, exact: true }).click();
  await expect(form.locator('#item-category')).toHaveText(config.drugCategory);
  await form.locator('#item-unit').fill('Tablet');
  await selectStaff(page, form, 'Search and select a staff member', config.drugAssignee);
  await snap(page, 'Item form filled');

  // Add Item
  await form.getByRole('button', { name: 'Add Item', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add New Item' })).toBeHidden({ timeout: 45000 });

  // Verify the item is in the Drug & Consumable Register
  const row = page.getByRole('row').filter({ hasText: itemName });
  await expect(row).toHaveCount(1, { timeout: 30000 });
  await expect(row).toContainText(config.drugCategory);
  await expect(row).toContainText(config.drugAssignee);
});
