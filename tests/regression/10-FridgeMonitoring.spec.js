import { test, expect } from '@playwright/test';
import { config } from '../../utils/config.js';
import { goToDailyOperation, selectStaff } from '../../utils/dailyOperations.js';
import { snap } from '../../utils/report.js';

test('Fridge Monitoring: add a fridge', { tag: ['@regression', '@daily-operations'] }, async ({ page }) => {
  test.setTimeout(180000);

  const fridgeName = `Vaccine Fridge ${Date.now()}`;

  await goToDailyOperation(page, 'Fridge Monitoring', /\/fridge-monitoring$/, 'Fridge Monitoring');

  // Add Fridge
  await page.getByRole('button', { name: 'Add Fridge' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Fridge Unit' });
  await expect(dialog).toBeVisible();

  // Mandatory fields (Min/Max Temp default to the 2-8°C cold-chain range)
  await dialog.getByPlaceholder('e.g. Vaccine Fridge A').fill(fridgeName);
  await dialog.getByPlaceholder('e.g. Treatment Room 1').fill(config.fridgeLocation);
  await dialog.locator('input[name="minTemp"]').fill('2');
  await dialog.locator('input[name="maxTemp"]').fill('8');
  await selectStaff(page, dialog, 'Search and select a staff member', config.fridgeAssignee);
  await snap(page, 'Fridge form filled');

  // Create Fridge Unit
  // Saving can take a while on the dev site (button shows "Creating...")
  await dialog.getByRole('button', { name: 'Create Fridge Unit' }).click();
  await expect(dialog).toBeHidden({ timeout: 45000 });

  // Verify the fridge is in the Fridge Register
  const row = page.getByRole('row').filter({ hasText: fridgeName });
  await expect(row).toHaveCount(1, { timeout: 30000 });
  await expect(row).toContainText(config.fridgeLocation);
  await expect(row).toContainText('2°C – 8°C');
  await expect(row).toContainText(config.fridgeAssignee);
});
