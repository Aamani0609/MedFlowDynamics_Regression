import { test, expect } from '@playwright/test';
import { clickSidebarItem, currentWeekLabel, expectSelected } from '../../utils/workforce.js';
import { snap } from '../../utils/report.js';

test('Workforce Dashboard: This Week, Next Week and Month View', { tag: ['@regression', '@workforce'] }, async ({ page }) => {
  test.setTimeout(150000);

  await page.goto('/dashboard');

  // The Workforce section is present in the sidebar, with its Dashboard link
  const workforce = page.locator('[data-sidebar="group"]').filter({
    has: page.locator('[data-sidebar="group-label"]', { hasText: /^Workforce$/i }),
  });
  await expect(workforce, 'Workforce section in the sidebar').toBeVisible({ timeout: 45000 });
  const dashboardLink = workforce.getByRole('link', { name: 'Dashboard', exact: true });
  await expect(dashboardLink).toBeVisible();

  // Workforce > Dashboard opens the Workforce Dashboard for the current week
  await clickSidebarItem(dashboardLink);
  await expect(page).toHaveURL(/\/rota-overview$/, { timeout: 45000 });
  await expect(page.getByRole('heading', { name: 'Workforce Dashboard', level: 1 })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /^Select week:/ })).toHaveText(currentWeekLabel());

  const heatmap = page.locator('div')
    .filter({ has: page.getByRole('heading', { name: 'Weekly Rota Coverage Heatmap' }) })
    .filter({ has: page.getByRole('button', { name: 'Month View' }) })
    .last();
  await expect(heatmap).toBeVisible();
  await snap(page, 'Workforce Dashboard');

  // This Week
  await heatmap.getByRole('button', { name: 'This Week', exact: true }).click();
  await expectSelected(heatmap, 'This Week');
  await snap(page, 'This Week');

  // Next Week
  await heatmap.getByRole('button', { name: 'Next Week', exact: true }).click();
  await expectSelected(heatmap, 'Next Week');
  await snap(page, 'Next Week');

  // Month View opens the month's rota coverage calendar
  await heatmap.getByRole('button', { name: 'Month View', exact: true }).click();
  const monthTitle = `${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}: Rota Coverage`;
  const monthView = page.getByRole('dialog').filter({ hasText: monthTitle });
  await expect(monthView, `"${monthTitle}" calendar`).toBeVisible({ timeout: 15000 });
  for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
    await expect(monthView.getByText(day, { exact: true })).toBeVisible();
  }
  for (const key of ['Fully Staffed', 'Partial', 'No Coverage', 'No Shifts']) {
    await expect(monthView.getByText(key, { exact: true }), `${key} legend`).toBeVisible();
  }
  await snap(page, 'Month View');

  // Close the month view
  await page.keyboard.press('Escape');
  await expect(monthView).toBeHidden();
});
