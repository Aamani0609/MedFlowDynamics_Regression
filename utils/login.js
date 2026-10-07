import { expect } from '@playwright/test';
import { config } from './config.js';

/**
 * Opens the login page and signs in with the given credentials.
 * Defaults to the username and password in config.properties.
 * @param {import('@playwright/test').Page} page
 * @param {string} [username]
 * @param {string} [password]
 */
export async function login(page, username = config.username, password = config.password) {
  await page.goto(config.loginPath);
  await expect(page.getByRole('heading', { name: 'Sign in to Medflow' })).toBeVisible();

  await page.getByLabel('Email address').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}
