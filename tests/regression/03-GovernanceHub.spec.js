import { test, expect } from '@playwright/test';
import { openGovernance, governanceItem } from '../../utils/governance.js';

/** The four pillars and their descriptions shown on the Governance Hub. */
const PILLARS = [
  { name: 'Clinical Governance', description: 'Quality and safety of clinical care delivery' },
  { name: 'Information Governance', description: 'Data protection, privacy and access control' },
  { name: 'Operational Governance', description: 'Workforce, premises, business continuity' },
  { name: 'Patient & Public Engagement', description: 'Patient voice, complaints, satisfaction' },
];

test('Governance Hub: shows the four pillars', { tag: ['@regression', '@governance'] }, async ({ page }) => {
  test.setTimeout(90000);

  await page.goto('/dashboard');

  // Governance > Governance Hub
  await openGovernance(page);
  await governanceItem(page, 'Governance Hub').click();

  await expect(page).toHaveURL(/\/governance$/, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Governance & Accountability' })).toBeVisible({ timeout: 15000 });

  // Summary count shows 4 pillars
  const pillarsStat = page.getByText('Pillars', { exact: true }).locator('xpath=preceding-sibling::p[1]');
  await expect(pillarsStat).toHaveText(String(PILLARS.length));

  // The Four Pillars section
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'The Four Pillars' }) });
  await expect(section).toBeVisible();

  for (const pillar of PILLARS) {
    await expect(section.getByText(pillar.name, { exact: true })).toBeVisible();
    await expect(section.getByText(pillar.description, { exact: true })).toBeVisible();
  }
});
