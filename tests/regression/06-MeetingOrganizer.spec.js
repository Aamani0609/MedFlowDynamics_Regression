import { test, expect } from '@playwright/test';
import { config } from '../../utils/config.js';
import { openGovernance, governanceItem } from '../../utils/governance.js';
import { pickDateTime } from '../../utils/dateTimePicker.js';

/**
 * Selects a person in a searchable combobox (Host, Minute taker).
 * @param {import('@playwright/test').Page} page
 * @param {string} placeholder
 * @param {string} name
 */
async function selectPerson(page, placeholder, name) {
  await page.getByRole('combobox').filter({ hasText: placeholder }).click();
  await page.getByRole('option', { name: new RegExp(name) }).first().click();
}

test('Meeting Organizer: schedule a Quality Improvement meeting', { tag: ['@regression', '@governance'] }, async ({ page }) => {
  test.setTimeout(120000);

  const meetingTitle = `${config.meetingType} ${Date.now()}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  await page.goto('/dashboard');

  // Governance > Meeting Organizer
  await openGovernance(page);
  const meetings = governanceItem(page, 'Meeting Organizer');
  await expect(meetings).toBeVisible();
  await meetings.click();

  await expect(page).toHaveURL(/\/meetings$/, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Meeting Organizer' })).toBeVisible({ timeout: 15000 });

  // Schedule meeting
  await page.getByRole('button', { name: 'Schedule meeting' }).click();
  await expect(page).toHaveURL(/\/meetings\/new/, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Schedule Meeting' })).toBeVisible({ timeout: 15000 });

  // Meeting type: Quality Improvement
  const meetingType = page.getByRole('combobox', { name: 'Meeting type' });
  await meetingType.click();
  await page.getByRole('option', { name: config.meetingType, exact: true }).click();
  await expect(meetingType).toHaveText(config.meetingType);

  // Mandatory fields (Duration defaults to 60 minutes)
  await page.getByLabel('Title').fill(meetingTitle);
  await pickDateTime(page, page.getByRole('button', { name: 'Select date and time' }), tomorrow, { hour: '10', minute: '00', period: 'AM' });
  await expect(page.getByRole('combobox', { name: 'Duration' })).not.toBeEmpty();
  await page.getByLabel('Location').fill(config.meetingLocation);
  await selectPerson(page, 'Select the host', config.meetingHost);
  await selectPerson(page, 'Select the minute taker', config.meetingMinuteTaker);

  // Schedule Meeting
  await page.getByRole('button', { name: 'Schedule Meeting', exact: true }).click();
  await expect(page).not.toHaveURL(/\/meetings\/new/, { timeout: 30000 });
  await expect(page.getByText(meetingTitle).first()).toBeVisible({ timeout: 15000 });
});
