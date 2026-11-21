import { expect, test, type Page } from '@playwright/test';

async function ruleCount(page: Page, ruleId: string): Promise<number> {
  return page
    .getByTestId('audit-issue-list')
    .locator('li')
    .filter({ hasText: ruleId })
    .count();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('3 issues');
});

test('computed styles update extracted tokens for Tailwind color swaps', async ({ page }) => {
  const editor = page.locator('#snippet-editor');
  const starterHtml = await editor.inputValue();
  await page.getByRole('button', { name: 'Extracted Tokens' }).click();
  const tokenList = page.getByTestId('extracted-token-list');

  for (const [className, hex] of [
    ['text-red-100', '#FEE2E2'],
    ['text-pink-100', '#FCE7F3'],
    ['text-black', '#000000'],
  ]) {
    await editor.fill(starterHtml.replace('text-slate-100', className));
    await expect(tokenList).toContainText(className);
    await expect(tokenList).toContainText(hex);
  }

  // The light shades still pass AA on the dark background; black does not.
  await page.getByRole('button', { name: 'Audit', exact: true }).click();
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('4 issues');
  expect(await ruleCount(page, 'color-contrast')).toBe(1);
  await expect(page.getByTestId('audit-issue-list')).toContainText('Text contrast is');
});

test('large text is checked against the 3:1 AA threshold', async ({ page }) => {
  await page.locator('#snippet-editor').fill(
    '<main class="min-h-screen bg-slate-950 p-8">' +
      '<h2 class="text-2xl text-slate-500">Large but legible</h2>' +
      '<p class="text-sm text-slate-500">Small and too dim</p>' +
      '</main>',
  );
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('1 issue');
  expect(await ruleCount(page, 'color-contrast')).toBe(1);
});

test('CSS variables are resolved for tokens and contrast checks', async ({ page }) => {
  await page.locator('#snippet-editor').fill(
    '<style>:root { --ink: #cccccc; --surface: #ffffff; }</style>' +
      '<main style="background-color: var(--surface); padding: 16px;">' +
      '<p style="color: var(--ink);">Low contrast copy</p>' +
      '</main>',
  );
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('1 issue');
  await expect(page.getByTestId('audit-issue-list')).toContainText('Text contrast is 1.61:1');

  await page.getByRole('button', { name: 'Extracted Tokens' }).click();
  const tokenList = page.getByTestId('extracted-token-list');
  await expect(tokenList).toContainText('ink');
  await expect(tokenList).toContainText('#CCCCCC');
});
