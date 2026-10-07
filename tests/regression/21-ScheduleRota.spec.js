import { test, expect } from '@playwright/test';
import { config } from '../../utils/config.js';
import { clickSidebarItem } from '../../utils/workforce.js';
import { snap } from '../../utils/report.js';

test('Schedule Rota: add a shift in Staff Rota, then open Clinician Rota', { tag: ['@regression', '@workforce'] }, async ({ page }) => {
  test.setTimeout(180000);

  await page.goto('/dashboard');

  // Workforce > Rota Management > Schedule Rota
  const rotaManagement = page.getByRole('button', { name: 'Rota Management', exact: true });
  await expect(rotaManagement).toBeVisible({ timeout: 45000 });
  if ((await rotaManagement.getAttribute('aria-expanded')) !== 'true') {
    await clickSidebarItem(rotaManagement);
  }
  await clickSidebarItem(page.getByRole('link', { name: 'Schedule Rota', exact: true }));
  // The URL carries the week and view, e.g. /rota-management?week=2026-10-06&viewBy=week&viewMode=overall
  await expect(page).toHaveURL(/\/rota-management(\?|$)/, { timeout: 45000 });
  await expect(page.getByRole('heading', { name: 'Schedule Rota', level: 1 })).toBeVisible({ timeout: 30000 });

  // Staff Rota
  await page.getByRole('button', { name: 'Staff Rota', exact: true }).click();
  await expect(page).toHaveURL(/viewMode=staff/, { timeout: 15000 });

  // Add Shift: pick a template, a role and at least one skill for it
  await page.getByRole('button', { name: 'Add Shift', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Shift Row' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: new RegExp(`^${config.rotaShiftTemplate}`) }).click();
  await expect(dialog.getByText('Adjust Time (Optional)')).toBeVisible();

  // "Roles Required" is labelled optional, but the server needs at least one role, and each role at least one skill
  await dialog.getByText(config.rotaRole, { exact: true }).click();
  await dialog.getByRole('checkbox', { name: config.rotaSkill, exact: true }).check();
  await snap(page, 'Add Shift Row filled');

  const saved = page.waitForResponse(r => r.url().includes('/api/rotas') && r.request().method() !== 'GET', { timeout: 30000 });
  await dialog.getByRole('button', { name: 'Add Shift Row' }).click();
  const response = await saved;
  expect(response.ok(), `Saving the shift returned ${await response.text()}`).toBe(true);
  await expect(dialog).toBeHidden({ timeout: 30000 });

  // If this week already has a shift at the same times, the role is added to it instead of a new row
  const addedToExisting = page.getByRole('dialog').filter({ hasText: 'Added to Existing Shift' });
  if (await addedToExisting.waitFor({ timeout: 5000 }).then(() => true, () => false)) {
    test.info().annotations.push({ type: 'note', description: `This week already had a ${config.rotaShiftTemplate}; the ${config.rotaRole} requirement was added to it.` });
    await snap(page, 'Added to existing shift');
    await addedToExisting.getByRole('button', { name: 'OK' }).click();
    await expect(addedToExisting).toBeHidden();
  }
  await expect(page.getByRole('main').getByText(config.rotaShiftTemplate).first(), 'New shift row in the Staff Rota').toBeVisible({ timeout: 30000 });
  await snap(page, 'Shift added to Staff Rota');

  // Clinician Rota (the view is not built yet and says "Coming Soon")
  await page.getByRole('button', { name: 'Clinician Rota', exact: true }).click();
  await expect(page).toHaveURL(/viewMode=clinician/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Clinician Rota Schedule' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Coming Soon', { exact: true })).toBeVisible();
  await snap(page, 'Clinician Rota');
});
