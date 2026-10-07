import { test, expect } from '@playwright/test';
import { config } from '../../utils/config.js';
import { openPatientVoiceTab } from '../../utils/frontDesk.js';
import { snap } from '../../utils/report.js';

test('Patient Voice: You Said, We Did - create a draft entry', { tag: ['@regression', '@front-desk'] }, async ({ page }) => {
  test.setTimeout(150000);

  const panel = await openPatientVoiceTab(page, 'You Said, We Did');

  const youSaid = `${config.youSaid} (${Date.now()})`;

  await expect(panel.getByRole('heading', { name: 'You Said, We Did' })).toBeVisible();

  // New entry
  await panel.getByRole('button', { name: 'New entry' }).click();
  const dialog = page.getByRole('dialog', { name: 'New Entry' });
  await expect(dialog).toBeVisible();

  // Mandatory fields
  await dialog.getByLabel('You said…').fill(youSaid);
  await dialog.getByLabel('We did…').fill(config.weDid);
  await expect(dialog.getByText(`${youSaid.length}/1000`)).toBeVisible();
  await expect(dialog.getByText(`${config.weDid.length}/2000`)).toBeVisible();
  await snap(page, 'New entry filled');

  // Create draft
  await dialog.getByRole('button', { name: 'Create draft' }).click();
  await expect(dialog).toBeHidden({ timeout: 30000 });

  // The entry is listed under Drafts, labelled Draft, with Edit and Publish
  await expect(panel.getByText(/^Drafts \(\d+\)$/i)).toBeVisible({ timeout: 30000 });
  const entry = panel.locator('div')
    .filter({ hasText: youSaid })
    .filter({ has: page.getByRole('button', { name: 'Publish' }) })
    .last();
  await expect(entry).toBeVisible();
  await expect(entry).toContainText(config.weDid);
  await expect(entry.getByText('Draft', { exact: true })).toBeVisible();
  await expect(entry.getByRole('button', { name: 'Edit' })).toBeVisible();
  await snap(page, 'Draft created');
});
