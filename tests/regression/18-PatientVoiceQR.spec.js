import { test, expect } from '@playwright/test';
import fs from 'fs';
import { openPatientVoiceTab } from '../../utils/frontDesk.js';

test('Patient Voice: QR Settings - download the QR code', { tag: ['@regression', '@front-desk'] }, async ({ page }) => {
  test.setTimeout(150000);

  const panel = await openPatientVoiceTab(page, 'QR Settings');

  await expect(panel.getByRole('heading', { name: 'Feedback QR Code' })).toBeVisible();
  await expect(panel.getByText(/\/patient-feedback\/\w+$/)).toBeVisible();

  // Download PNG
  const downloadStarted = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download PNG' }).click();
  const download = await downloadStarted;

  expect(download.suggestedFilename()).toMatch(/\.png$/i);
  const file = test.info().outputPath(download.suggestedFilename());
  await download.saveAs(file);
  expect(fs.statSync(file).size, 'Downloaded PNG size').toBeGreaterThan(0);
  await test.info().attach('Downloaded QR code', { path: file, contentType: 'image/png' });
});
