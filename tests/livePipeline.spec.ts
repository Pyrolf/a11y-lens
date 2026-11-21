import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('audit-report')).toBeVisible();
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('3 issues');
});

test('edits update audit findings and extracted tokens without a manual run', async ({ page }) => {
  const editor = page.locator('#snippet-editor');
  const starterHtml = await editor.inputValue();

  await editor.fill(
    `${starterHtml}\n<p style="color: #cccccc; background-color: #ffffff;">Fresh low contrast copy</p>\n<img src="x.png" />`,
  );

  await expect(page.getByTestId('preview-issue-badge')).toHaveText('5 issues');
  await expect(page.getByTestId('audit-issue-list')).toContainText('Image is missing an alt attribute.');
  await expect(page.getByTestId('audit-issue-list')).toContainText('Text contrast is');

  await page.getByRole('button', { name: 'Extracted Tokens' }).click();
  await expect(page.getByTestId('extracted-token-list')).toContainText('#CCCCCC');
});

test('Default / Starter preset is selectable and always resets manual edits', async ({ page }) => {
  const editor = page.locator('#snippet-editor');
  const starterHtml = await editor.inputValue();
  const defaultPreset = page.getByRole('button', { name: 'Load default preset: Default / Starter' });

  await expect(defaultPreset).toBeVisible();
  await expect(defaultPreset).toHaveAttribute('aria-pressed', 'true');

  await editor.fill('<main><img src="x.png"></main>');
  await expect(editor).toHaveValue('<main><img src="x.png"></main>');
  await expect(defaultPreset).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('1 issue');

  await defaultPreset.click();
  await expect(editor).toHaveValue(starterHtml);
  await expect(defaultPreset).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('3 issues');

  // It stays actionable even when it is already the selected preset.
  await defaultPreset.click();
  await expect(editor).toHaveValue(starterHtml);
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('3 issues');
});

test('auto-audit status pill exposes a manual re-run with Synced confirmation', async ({ page }) => {
  await expect(page.getByTestId('auto-audit-status')).toContainText('Auto-Audit: ON');
  await expect(page.getByTestId('rerun-audit-button')).toBeVisible();

  await page.getByTestId('rerun-audit-button').click();
  await expect(page.getByTestId('auto-audit-synced')).toBeVisible();
  await expect(page.getByTestId('auto-audit-synced')).toBeHidden({ timeout: 3000 });
  await expect(page.getByTestId('audit-report')).toBeVisible();
});
