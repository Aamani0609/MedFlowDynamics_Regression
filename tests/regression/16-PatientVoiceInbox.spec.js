import { test, expect } from '@playwright/test';
import { openPatientVoiceTab } from '../../utils/frontDesk.js';
import { snap } from '../../utils/report.js';

test('Patient Voice: Inbox shows search, filters and the submission list', { tag: ['@regression', '@front-desk'] }, async ({ page }) => {
  test.setTimeout(150000);

  const panel = await openPatientVoiceTab(page, 'Inbox');

  await expect(panel.getByRole('textbox', { name: 'Search feedback' })).toBeVisible();
  await expect(panel.getByText(/^\d+ results?$/)).toBeVisible();

  // Each filter can be selected
  for (const filter of ['Praise', 'Suggestions', 'Complaints', 'All']) {
    const button = panel.getByRole('button', { name: filter, exact: true });
    await button.click();
    await expect(button, `${filter} filter`).toHaveAttribute('aria-pressed', 'true');
  }

  // Detail pane prompt until a submission is opened
  await expect(panel.getByText('Select a submission to view details')).toBeVisible();
  await snap(page, 'Inbox');
});
