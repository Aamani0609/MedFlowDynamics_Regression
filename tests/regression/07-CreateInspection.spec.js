import { test, expect } from '@playwright/test';
import {
  openEvidenceLocker,
  evidenceLockerItem,
  openInspections,
  totalInspections,
} from '../../utils/evidenceLocker.js';

test('Evidence Locker: create an internal mock inspection and find it in Inspections', { tag: ['@regression', '@evidence-locker'] }, async ({ page }) => {
  test.setTimeout(240000);

  const inspectionName = `Internal mock ${Date.now()}`;

  await page.goto('/dashboard');

  // Note the Total inspections count before creating a new one
  const totalBefore = await openInspections(page);

  // Evidence Locker > Create Inspection
  await openEvidenceLocker(page);
  await evidenceLockerItem(page, 'Create Inspection').click();
  await expect(page).toHaveURL(/\/evidence-locker\/inspections\/new/);
  await expect(page.getByText('Inspection setup')).toBeVisible();

  // Select Internal mock inspection
  const internalMock = page.getByRole('radio', { name: /Internal mock inspection/ });
  await internalMock.click();
  await expect(internalMock).toBeChecked();

  // Mandatory fields
  await page.getByLabel('Inspection name').fill(inspectionName);

  await page.getByRole('combobox', { name: 'Inspection type' }).click();
  await page.getByRole('option', { name: 'Routine' }).click();

  await page.getByRole('button', { name: 'Select date' }).click();
  await page.getByRole('button', { name: /^Today/ }).click();
  const done = page.getByRole('button', { name: 'Done' });
  if (await done.isVisible()) await done.click();

  await page.getByRole('combobox').filter({ hasText: 'Search and select an assessor' }).click();
  await page.getByRole('option', { name: /Mitra R/ }).click();

  // Continue to evidence pack
  await page.getByRole('button', { name: 'Continue to evidence pack' }).click();

  await expect(page).toHaveURL(/\/evidence-locker\/inspections\/INS-/, { timeout: 30000 });
  await expect(page.getByText('INSPECTION LIFECYCLE')).toBeVisible();
  await expect(page.getByText(inspectionName).first()).toBeVisible();

  // Verify Total inspections went up by 1
  await openInspections(page);
  await expect(totalInspections(page)).toHaveText(String(totalBefore + 1), { timeout: 15000 });
  const totalAfter = Number(await totalInspections(page).innerText());

  // Search for the new inspection so it is found on any page of the list
  await page.getByPlaceholder('Search inspections...').fill(inspectionName);

  const row = page.getByRole('row').filter({ hasText: inspectionName });
  await expect(row).toHaveCount(1, { timeout: 15000 });
  await expect(row).toContainText('Internal mock');
  await expect(row).toContainText('Draft');
  await expect(row).toContainText('Lead: Mitra R');

  // Show the total number of inspections in the terminal and in the HTML report
  console.log(`Total inspections before: ${totalBefore}, after: ${totalAfter}`);
  test.info().annotations.push({
    type: 'Total inspections',
    description: `before: ${totalBefore}, after: ${totalAfter}`,
  });

  // Clear the search so the page shows the full total, then wait 2 minutes
  await page.getByPlaceholder('Search inspections...').clear();
  await expect(totalInspections(page)).toHaveText(String(totalAfter));
  await page.waitForTimeout(2000);
});
