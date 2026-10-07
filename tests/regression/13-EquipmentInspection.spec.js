import { test } from '@playwright/test';
import { config } from '../../utils/config.js';
import { createTemplateAndSchedule } from '../../utils/dailyOperations.js';

test('Premises & Equipment: create an equipment inspection template and schedule it', { tag: ['@regression', '@daily-operations'] }, async ({ page }) => {
  test.setTimeout(240000);

  await createTemplateAndSchedule(page, {
    kind: 'Equipment Inspection',
    createButton: 'Create Equipment Template',
    dialogName: 'Create Equipment Inspection Template',
    type: config.equipmentType,
    check: 'Is the oxygen cylinder full, in date and stored upright?',
    checkCategory: 'Equipment',
  });
});
