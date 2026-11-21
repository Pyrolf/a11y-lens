import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('3 issues');
});

test('Extracted Tokens has one authored-only view and no mode toggle', async ({ page }) => {
  await page.getByRole('button', { name: 'Extracted Tokens' }).click();

  await expect(page.getByTestId('token-mode-toggle')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Extracted token mode' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Authored Only' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'All Computed' })).toHaveCount(0);
  await expect(page.getByTestId('authored-token-summary')).toBeVisible();

  const tokenList = page.getByTestId('extracted-token-list');
  await expect(tokenList).toContainText('text-slate-100');
  await expect(tokenList).not.toContainText('Text Color');
  await expect(tokenList).not.toContainText('Inherited');
});

test('only explicit declarations are shown; inherited computed values stay hidden', async ({
  page,
}) => {
  await page
    .locator('#snippet-editor')
    .fill('<div style="color: #111827;"><p>Inherited copy</p></div>');
  await page.getByRole('button', { name: 'Extracted Tokens' }).click();

  const tokenList = page.getByTestId('extracted-token-list');
  await expect(tokenList).toContainText('#111827');
  await expect(tokenList).not.toContainText('text-slate-100');
  await expect(tokenList).not.toContainText('Text Color');
  await expect(tokenList).not.toContainText('Inherited');
});

test('authored tokens cover Tailwind utilities, CSS variables and inline styles', async ({
  page,
}) => {
  await page.locator('#snippet-editor').fill(
    '<style>:root { --brand: #111827; }</style>' +
      '<main class="bg-slate-950" style="padding: 16px;">' +
      '<h1 class="text-slate-100">Authored</h1>' +
      '<p style="color: var(--brand);">Variable</p>' +
      '</main>',
  );
  await page.getByRole('button', { name: 'Extracted Tokens' }).click();

  const tokenList = page.getByTestId('extracted-token-list');
  await expect(tokenList).toContainText('text-slate-100');
  await expect(tokenList).toContainText('bg-slate-950');
  await expect(tokenList).toContainText('brand');
  await expect(tokenList).toContainText('#111827');
  await expect(tokenList).not.toContainText('Text Color');
});

test('implicit contrast bugs are still reported while viewing authored tokens', async ({
  page,
}) => {
  await page.locator('#snippet-editor').fill(
    '<main style="background-color: #ffffff; color: #cccccc; padding: 16px;">' +
      '<p>Implicitly low contrast</p></main>',
  );
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('1 issue');
  await expect(page.getByTestId('audit-issue-list')).toContainText('Text contrast is 1.61:1');

  await page.getByRole('button', { name: 'Extracted Tokens' }).click();
  const tokenList = page.getByTestId('extracted-token-list');
  await expect(tokenList).toContainText('#CCCCCC');
  await expect(tokenList).not.toContainText('Text Color');
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('1 issue');

  await page.getByRole('button', { name: 'Audit', exact: true }).click();
  await expect(page.getByTestId('audit-issue-list')).toContainText('Text contrast is 1.61:1');
});
