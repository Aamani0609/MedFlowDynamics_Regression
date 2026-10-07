import { test } from '@playwright/test';
import { config } from '../../utils/config.js';
import { createTemplateAndSchedule } from '../../utils/dailyOperations.js';

test('Premises & Equipment: create a premises checklist template and schedule it', { tag: ['@regression', '@daily-operations'] }, async ({ page }) => {
  test.setTimeout(240000);

  await createTemplateAndSchedule(page, {
    kind: 'Premises Checklist',
    createButton: 'Create Premises Template',
    dialogName: 'Create Premises Checklist Template',
    type: config.premisesType,
    check: 'Is the fire extinguisher in date and accessible?',
    checkCategory: 'Safety',
  });
});
