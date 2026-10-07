import { test, expect } from '@playwright/test';
import { config } from '../../utils/config.js';
import { login } from '../../utils/login.js';

const authFile = 'playwright/.auth/user.json';

test('Login: sign in with valid credentials', { tag: ['@regression', '@login'] }, async ({ page }) => {
  test.setTimeout(120000);

  await login(page);

  // Verify the user is logged in to Medflow Dynamics
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
  await expect(page).toHaveTitle(config.appTitle);
  // The dashboard can take a while to render on the dev site
  await expect(page.getByText(/Good (morning|afternoon|evening), Ruthwik/)).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(config.username).first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('INSPECTION READINESS')).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('heading', { name: 'Sign in to Medflow' })).toBeHidden();

  // Save the signed-in session for the tests that depend on the login project
  await page.context().storageState({ path: authFile });
});
