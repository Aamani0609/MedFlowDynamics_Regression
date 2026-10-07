import { expect } from '@playwright/test';

/**
 * Returns the Risk & Safety dropdown in the navigation.
 * @param {import('@playwright/test').Page} page
 */
export function riskSafetyDropdown(page) {
  return page.getByRole('button', { name: 'Risk & Safety', exact: true });
}

/**
 * Returns a menu item link under the Risk & Safety dropdown.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export function riskSafetyItem(page, name) {
  // Sidebar link only, so the breadcrumb link with the same name is ignored
  return page.getByRole('link', { name, exact: true }).and(page.locator('[data-sidebar="menu-sub-button"]'));
}

/**
 * Opens the Risk & Safety dropdown and checks it is enabled.
 * @param {import('@playwright/test').Page} page
 */
export async function openRiskSafety(page) {
  const dropdown = riskSafetyDropdown(page);
  await expect(dropdown).toBeVisible({ timeout: 30000 });
  await expect(dropdown).toBeEnabled();
  if ((await dropdown.getAttribute('aria-expanded')) !== 'true') {
    await dropdown.click();
  }
}
