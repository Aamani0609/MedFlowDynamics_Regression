import { expect } from '@playwright/test';

/**
 * Clicks a sidebar item. Workforce items sit at the bottom of the sidebar, where the floating
 * Feedback button can cover them, so the item is scrolled to the middle first.
 * @param {import('@playwright/test').Locator} item
 */
export async function clickSidebarItem(item) {
  await expect(item).toBeVisible({ timeout: 45000 });
  await item.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await item.click({ timeout: 30000 });
}

/** Monday-to-Sunday range of the current week as the week picker shows it, e.g. "Oct 5 - Oct 11, 2026". */
export function currentWeekLabel() {
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const short = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${short(monday)} - ${short(sunday)}, ${sunday.getFullYear()}`;
}

/**
 * Checks which heatmap view button is selected: it is highlighted (indigo), the others are muted.
 * @param {import('@playwright/test').Locator} card the Weekly Rota Coverage Heatmap card
 * @param {'This Week' | 'Next Week' | 'Month View'} selected
 */
export async function expectSelected(card, selected) {
  for (const view of ['This Week', 'Next Week', 'Month View']) {
    const button = card.getByRole('button', { name: view, exact: true });
    if (view === selected) {
      await expect(button, `${view} selected`).toHaveClass(/bg-indigo-500/);
    } else {
      await expect(button, `${view} not selected`).not.toHaveClass(/bg-indigo-500/);
    }
  }
}
