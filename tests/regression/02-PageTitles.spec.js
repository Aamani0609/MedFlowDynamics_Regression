import { test, expect } from '@playwright/test';
import { config } from '../../utils/config.js';

/** Main pages of the app, each checked for the browser tab title. */
const PAGES = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Governance Hub', path: '/governance' },
  { name: 'Audits', path: '/audits' },
  { name: 'Meeting Organizer', path: '/meetings' },
  { name: 'Inspections', path: '/evidence-locker/inspection-history' },
  { name: 'Risk & Compliance', path: '/risk-compliance' },
  { name: 'Safety Hub', path: '/safety-hub' },
  { name: 'Fridge Monitoring', path: '/fridge-monitoring' },
  { name: 'Drug & Consumable', path: '/drug-consumable' },
  { name: 'Premises & Equipment', path: '/premises-checklists' },
  { name: 'Visitor Log', path: '/visitor-intelligence' },
  { name: 'Patient Voice', path: '/patient-voice' },
  { name: 'Staff Management', path: '/staff' },
  { name: 'Workforce Dashboard', path: '/rota-overview' },
];

test(`Page titles: every page is titled "${config.appTitle}"`, { tag: ['@regression', '@dashboard'] }, async ({ page, browser }) => {
  test.setTimeout(300000);

  await test.step('Login page (signed out)', async () => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const loginPage = await context.newPage();
    await loginPage.goto(config.loginPath);
    await expect(loginPage.getByRole('heading', { name: 'Sign in to Medflow' })).toBeVisible({ timeout: 30000 });
    await expect(loginPage).toHaveTitle(config.appTitle);
    await context.close();
  });

  for (const { name, path } of PAGES) {
    await test.step(name, async () => {
      await page.goto(path);
      // Still signed in and on the requested page
      await expect(page).toHaveURL(new RegExp(`${path.replace(/[/-]/g, '\\$&')}$`), { timeout: 45000 });
      await expect(page.getByRole('main')).toBeVisible({ timeout: 45000 });
      await expect(page, `${name} title`).toHaveTitle(config.appTitle);
    });
  }
});
