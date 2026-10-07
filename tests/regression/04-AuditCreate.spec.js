import { test, expect } from '@playwright/test';
import { config } from '../../utils/config.js';
import { createAudit } from '../../utils/audits.js';
import { openGovernance, governanceItem } from '../../utils/governance.js';

test('Audits: create an audit from a template and find it in the Audit Register', { tag: ['@regression', '@governance'] }, async ({ page }) => {
  test.setTimeout(150000);

  const auditId = await createAudit(page);

  // Verify the audit is listed in the Audit Register
  await openGovernance(page);
  await governanceItem(page, 'Audits').click();
  await expect(page).toHaveURL(/\/audits$/, { timeout: 30000 });
  await page.reload();

  const row = page.getByRole('row').filter({ hasText: auditId });
  await expect(row).toHaveCount(1, { timeout: 15000 });
  await expect(row).toContainText(config.auditTemplate);
  await expect(row).toContainText(config.auditLead);
});
