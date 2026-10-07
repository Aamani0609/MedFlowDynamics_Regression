import { test, expect } from '@playwright/test';
import { config } from '../../utils/config.js';
import { createAudit, isoDate, monthsFromToday, workflowStep } from '../../utils/audits.js';
import { login } from '../../utils/login.js';
import { snap } from '../../utils/report.js';

test('Audits: complete the audit workflow (standards, findings, actions, re-audit, approval)', { tag: ['@regression', '@governance'] }, async ({ page, browser }) => {
  test.setTimeout(240000);

  let auditUrl = '';

  await test.step('1. Create audit (Planned)', async () => {
    await createAudit(page);
    auditUrl = page.url();
    await expect(page.getByText('Step 1 of 6')).toBeVisible();
    await snap(page, 'Audit created');
  });

  await test.step('2. Add Standards', async () => {
    await page.getByRole('button', { name: 'Add Standards' }).click();
    await page.getByRole('button', { name: 'Add First Standard' }).click();
    const standardDialog = page.getByRole('dialog', { name: 'Add Standard' });
    await standardDialog.getByLabel('Standard Name').fill('Repeat prescribing medication review');
    await standardDialog.getByLabel('Reference').fill('NICE NG5');
    await standardDialog.getByLabel('Compliance % (0-100)').fill('85');
    await standardDialog.getByLabel('Target % (0-100)').fill('95');
    await snap(page, 'Standard form filled');
    await standardDialog.getByRole('button', { name: 'Add Standard' }).click();
    await expect(standardDialog).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Repeat prescribing medication review' })).toBeVisible();
    await expect(page.getByText('Step 2 of 6')).toBeVisible();
    await snap(page, 'Standard added');
  });

  await test.step('3. Add Findings', async () => {
    await page.getByRole('button', { name: 'Add Findings' }).click();
    await page.getByRole('button', { name: 'Add First Finding' }).click();
    const findingDialog = page.getByRole('dialog', { name: 'Add Finding' });
    await findingDialog.getByLabel('Area').fill('Repeat prescribing');
    await findingDialog.getByLabel('Observation').fill('Several repeat prescriptions were issued without a medication review.');
    await findingDialog.getByRole('combobox', { name: 'Severity' }).click();
    await page.getByRole('option', { name: 'Major', exact: true }).click();
    await findingDialog.getByLabel('Recommendation').fill('Add a medication review check before repeat prescriptions are signed.');
    await snap(page, 'Finding form filled');
    await findingDialog.getByRole('button', { name: 'Add Finding' }).click();
    await expect(findingDialog).toBeHidden();
    await expect(page.getByText('Step 3 of 6')).toBeVisible();
    await snap(page, 'Finding added');
  });

  await test.step('4. Add Actions', async () => {
    const actionTitle = 'Add medication review check';
    // The workflow button opens the New SMART Action form on the Actions tab
    await page.getByRole('button', { name: 'Add Actions' }).click();
    await expect(page.getByRole('heading', { name: 'New SMART Action' })).toBeVisible();
    await page.getByPlaceholder('e.g., Implement hand hygiene training').fill(actionTitle);
    await page.getByPlaceholder('Detailed description of what needs to be done...').fill('Add a medication review check to the repeat prescribing workflow.');
    await page.locator('input[type="date"]').fill(isoDate(monthsFromToday(1)));
    await page.getByRole('combobox').filter({ hasText: 'Select a staff member...' }).click();
    await page.getByRole('option', { name: new RegExp(config.auditActionOwner) }).click();
    await snap(page, 'Action form filled');
    await page.getByRole('button', { name: 'Create Action' }).last().click();
    await expect(page.getByText(actionTitle, { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Step 4 of 6')).toBeVisible();
    await snap(page, 'Action created');
  });

  await test.step('5. Reschedule (re-audit)', async () => {
    // Actions must be complete before the re-audit can be scheduled; the dialog then opens.
    // On a slow load the first click can be lost, so retry until the action is complete.
    await expect(async () => {
      await page.getByRole('button', { name: 'Mark Complete' }).click({ timeout: 5000 });
      await expect(page.getByText('1 of 1 actions complete')).toBeVisible({ timeout: 10000 });
    }).toPass({ timeout: 60000 });
    const reAuditDialog = page.getByRole('dialog', { name: 'Schedule Re-audit' });
    await expect(reAuditDialog).toBeVisible({ timeout: 30000 });
    await reAuditDialog.getByLabel('Re-audit Date').fill(isoDate(monthsFromToday(6)));
    await snap(page, 'Re-audit date chosen');
    await reAuditDialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(reAuditDialog).toBeHidden();
    await expect(page.getByText('Step 5 of 6')).toBeVisible();
    await expect(workflowStep(page, 'Add Actions')).toHaveText('Completed');
    await expect(page.getByText('Awaiting Approval')).toBeVisible({ timeout: 15000 });
    await snap(page, 'Re-audit scheduled');
  });

  await test.step('6. Send for approval', async () => {
    // The creator can't approve their own audit, so send it to another approver
    await page.getByRole('button', { name: 'Send for approval' }).click();
    const approvalDialog = page.getByRole('dialog', { name: 'Send for approval' });
    await approvalDialog.getByRole('radio', { name: new RegExp(config.auditApprover) }).click();
    await snap(page, 'Approver chosen');
    await approvalDialog.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(approvalDialog).toBeHidden();
    // The approver is listed under Approvers as Pending
    await expect(page.getByText(/^Approvers/)).toBeVisible({ timeout: 15000 });
    const approver = page.locator('div').filter({ has: page.getByText(config.auditApprover, { exact: true }) }).filter({ hasText: 'Pending' }).last();
    await expect(approver).toBeVisible({ timeout: 15000 });
    await snap(page, 'Sent for approval');
  });

  if (!config.approverUsername || !config.approverPassword) {
    test.info().annotations.push({
      type: 'warning',
      description: 'Set approverUsername and approverPassword in config.properties to approve and close the audit.',
    });
    return;
  }

  await test.step('7. Closed & Approved (approver)', async () => {
    // Approver signs in separately and closes the audit
    const approverContext = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: page.viewportSize() });
    const approverPage = await approverContext.newPage();
    await login(approverPage, config.approverUsername, config.approverPassword);
    await expect(approverPage).toHaveURL(/\/dashboard/, { timeout: 30000 });

    await approverPage.goto(auditUrl);
    await approverPage.getByRole('button', { name: /approve/i }).first().click();
    const confirmDialog = approverPage.getByRole('dialog');
    if (await confirmDialog.isVisible()) {
      await confirmDialog.getByRole('button', { name: /approve|confirm/i }).last().click();
    }
    await expect(workflowStep(approverPage, 'Closed & Approved')).toHaveText('Completed', { timeout: 15000 });
    await snap(approverPage, 'Closed and approved');
    await approverContext.close();
  });
});
