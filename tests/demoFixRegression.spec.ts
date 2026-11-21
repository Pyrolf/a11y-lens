import { expect, test } from '@playwright/test';

test('Tailwind dark-background eight-rule stress test drops to zero', async ({ page }) => {
  await page.goto('/');
  await page.locator('#snippet-editor').fill(
    '<main class="bg-slate-950 p-8">' +
      '<h1 class="text-white">Title</h1>' +
      '<h3 class="text-slate-500">Details</h3>' +
      '<img src="/logo.png" />' +
      '<a href="#" class="text-slate-100">Click here</a>' +
      '<button tabindex="3" class="outline-none text-slate-100"></button>' +
      '<button class="text-slate-100">Action</button>' +
      '<input type="text" placeholder="Email" class="text-slate-100" />' +
      '</main>',
  );

  await expect(page.getByTestId('preview-issue-badge')).toHaveText('8 issues');
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByRole('button', { name: 'Try Demo AI Fix (No Key Required)' }).click();
  await expect(page.getByTestId('ai-fix-result')).toBeVisible();
  await page.getByTestId('apply-ai-fix-button').click();

  await expect(page.getByTestId('preview-issue-badge')).toHaveText('0 issues');
  const patched = await page.locator('#snippet-editor').inputValue();
  expect(patched).toContain('<h2 class="text-slate-100">Details</h2>');
  expect(patched).toContain('<h1 class="text-white">Title</h1>');
});

test('duplicate h1 headings are demoted so heading-order resolves to zero', async ({ page }) => {
  await page.goto('/');
  await page.locator('#snippet-editor').fill(
    '<main class="bg-white p-8">' +
      '<h1 id="page-title" class="text-slate-900">Page title</h1>' +
      '<h1 id="section-title" class="text-slate-900">Section title</h1>' +
      '</main>',
  );

  await expect(page.getByTestId('preview-issue-badge')).toHaveText('1 issue');
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('demo-ai-fix-button').click();
  await expect(page.getByTestId('ai-fix-result')).toBeVisible();
  await page.getByTestId('apply-ai-fix-button').click();

  await expect(page.getByTestId('preview-issue-badge')).toHaveText('0 issues');
  const patched = await page.locator('#snippet-editor').inputValue();
  expect(patched).toContain('<h1 id="page-title" class="text-slate-900">Page title</h1>');
  expect(patched).toContain('<h2 id="section-title" class="text-slate-900">Section title</h2>');
});

test('banner demo button forces demo mode after a BYOK provider was selected', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');
  await expect(page.getByTestId('ai-provider-select')).toHaveValue('openrouter');

  await page.getByRole('button', { name: 'Try Demo AI Fix (No Key Required)' }).click();

  await expect(page.getByTestId('ai-provider-select')).toHaveValue('demo');
  await expect(page.getByTestId('ai-fix-result')).toBeVisible();
  await expect(page.getByTestId('ai-fix-diff')).toBeVisible();
  await expect(page.getByTestId('ai-fix-result')).toContainText('Demo fix');
  expect(await page.evaluate(() => window.sessionStorage.getItem('a11y-lens.ai.provider'))).toBe('"demo"');
});
