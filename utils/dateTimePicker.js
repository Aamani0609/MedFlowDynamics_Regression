import { expect } from '@playwright/test';

/** Returns a date as YYYY-MM-DD in local time, matching the calendar's data-day attribute. */
export function localIsoDate(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Picks a day and time in the shared date & time popover (calendar + Hour/Min/AM-PM columns).
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} trigger the button that opens the popover
 * @param {Date} date
 * @param {{ hour: string, minute: string, period: 'AM' | 'PM' }} time
 */
export async function pickDateTime(page, trigger, date, time) {
  const picker = await openCalendarAt(page, trigger, date);

  // Hour and minute buttons sit in the list right after each column header
  const column = header => picker.getByText(header, { exact: true }).locator('xpath=following-sibling::*[1]');
  await column('Hour').getByRole('button', { name: time.hour, exact: true }).click();
  await column('Min').getByRole('button', { name: time.minute, exact: true }).click();
  await picker.getByRole('button', { name: time.period, exact: true }).click();

  await picker.getByRole('button', { name: 'Done' }).click();
  await expect(picker).toBeHidden();
}

/**
 * Picks a day in a calendar-only date popover and confirms it with Done.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} trigger the button that opens the popover
 * @param {Date} date
 */
export async function pickDate(page, trigger, date) {
  const picker = await openCalendarAt(page, trigger, date);
  await picker.getByRole('button', { name: 'Done' }).click();
  await expect(picker).toBeHidden();
}

/**
 * Opens the calendar popover, moves to the month of the date and clicks the day.
 * @returns the calendar popover
 */
async function openCalendarAt(page, trigger, date) {
  await trigger.click();
  const picker = page.getByRole('dialog').filter({ has: page.getByRole('grid') });
  await expect(picker).toBeVisible();

  // Move to the right month if the day is not in the one shown
  const day = picker.locator(`td[data-day="${localIsoDate(date)}"]:not([data-outside]) button`);
  if (!(await day.isVisible())) {
    const shown = new Date(`${await picker.getByRole('grid').getAttribute('aria-label')} 1`);
    const direction = date > shown ? 'Next' : 'Previous';
    await picker.getByRole('button', { name: `Go to the ${direction} Month` }).click();
  }
  await day.click();
  return picker;
}
