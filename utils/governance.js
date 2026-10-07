import { expect } from '@playwright/test';

/**
 * Returns the Governance dropdown in the navigation.
 * @param {import('@playwright/test').Page} page
 */
export function governanceDropdown(page) {
  return page.getByRole('button', { name: 'Governance', exact: true });
}

/**
 * Returns a menu item link under the Governance dropdown.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export function governanceItem(page, name) {
  // Sidebar link only, so the breadcrumb link with the same name is ignored
  return page.getByRole('link', { name, exact: true }).and(page.locator('[data-sidebar="menu-sub-button"]'));
}

/**
 * Opens the Governance dropdown and checks it is enabled.
 * @param {import('@playwright/test').Page} page
 */
export async function openGovernance(page) {
  const dropdown = governanceDropdown(page);
  await expect(dropdown).toBeVisible({ timeout: 30000 });
  await expect(dropdown).toBeEnabled();
  if ((await dropdown.getAttribute('aria-expanded')) !== 'true') {
    await dropdown.click();
  }
}
