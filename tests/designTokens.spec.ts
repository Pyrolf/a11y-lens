import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Design Tokens' }).click();
  await expect(page.getByTestId('token-json-editor')).toBeVisible();
});

test('sample tokens render color swatches and AA pass/fail badges', async ({ page }) => {
  await expect(page.getByTestId('token-json-editor')).toContainText('"contrastPairs"');
  await expect(page.getByTestId('token-validation')).toContainText('JSON valid');
  await expect(page.getByTestId('color-token')).toHaveCount(8);
  await expect(page.getByTestId('contrast-check')).toHaveCount(4);
  await expect(page.getByTestId('contrast-badge').filter({ hasText: 'PASS' })).toHaveCount(3);
  await expect(page.getByTestId('contrast-badge').filter({ hasText: 'FAIL' })).toHaveCount(1);
  await expect(page.getByTestId('contrast-check-list')).toContainText('1.48:1');
});

test('accepts the colors key plus fg/bg and text/surface pair aliases', async ({ page }) => {
  const editor = page.getByTestId('token-json-editor');
  await editor.fill(
    JSON.stringify(
      {
        colors: {
          'surface.base': '#FFFFFF',
          'text.primary': '#111827',
          'brand.primary': '#4F46E5',
          'brand.onPrimary': '#FFFFFF',
        },
        contrastPairs: [
          { fg: 'text.primary', bg: 'surface.base' },
          { text: 'brand.onPrimary', surface: 'brand.primary' },
        ],
      },
      null,
      2,
    ),
  );

  await expect(page.getByTestId('token-validation')).toContainText('JSON valid');
  await expect(page.getByTestId('color-token')).toHaveCount(4);
  await expect(page.getByTestId('contrast-check')).toHaveCount(2);
  await expect(page.getByTestId('contrast-check-list')).toContainText(
    'text.primary on surface.base',
  );
  await expect(page.getByTestId('contrast-check-list')).toContainText(
    'brand.onPrimary on brand.primary',
  );
  await expect(page.getByTestId('contrast-badge').filter({ hasText: 'PASS' })).toHaveCount(2);
});

test('infers default contrast pairs when contrastPairs is omitted', async ({ page }) => {
  const editor = page.getByTestId('token-json-editor');
  const sample = JSON.parse(await editor.inputValue()) as Record<string, unknown>;
  delete sample.contrastPairs;
  await editor.fill(JSON.stringify(sample, null, 2));

  await expect(page.getByTestId('token-validation')).toContainText('JSON valid');
  await expect(page.getByTestId('contrast-check').first()).toBeVisible();
  await expect(page.getByTestId('contrast-check-list')).toContainText(
    'text.primary on surface.base',
  );
  await expect(page.getByTestId('contrast-check-list')).toContainText(
    'brand.onPrimary on brand.primary',
  );
});

test('merges color and colors keys and falls back to lightest/darkest inference', async ({
  page,
}) => {
  await page.getByTestId('token-json-editor').fill(
    JSON.stringify({
      colors: { beta: '#FFFFFF' },
      color: { alpha: '#111827' },
    }),
  );

  await expect(page.getByTestId('token-validation')).toContainText('JSON valid');
  await expect(page.getByTestId('color-token')).toHaveCount(2);
  await expect(page.getByTestId('contrast-check')).toHaveCount(1);
  await expect(page.getByTestId('contrast-check-list')).toContainText('alpha on beta');
  await expect(page.getByTestId('contrast-check-list')).toContainText('17.74:1');
});

test('invalid hex codes are flagged instead of producing contrast results', async ({ page }) => {
  const editor = page.getByTestId('token-json-editor');
  const json = await editor.inputValue();
  await editor.fill(json.replace('#FFFFFF', '#GGGGGG'));

  await expect(page.getByTestId('token-validation')).toContainText('hex color');
  await expect(page.getByTestId('invalid-hex-badge')).toHaveCount(1);
  await expect(page.getByTestId('contrast-badge').filter({ hasText: 'N/A' })).toHaveCount(3);
});

test('malformed JSON reports a parse error', async ({ page }) => {
  await page.getByTestId('token-json-editor').fill('{"color": {');
  await expect(page.getByTestId('token-validation')).toContainText('Invalid JSON');
  await expect(page.getByTestId('copy-css-variables')).toBeDisabled();
});

test('Copy CSS Variables writes generated custom properties to the clipboard', async ({ page }) => {
  await page.getByRole('button', { name: 'Copy CSS Variables' }).click();

  await expect(page.getByRole('status')).toContainText('Copied CSS variables');
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('--color-surface-base: #FFFFFF;');
  expect(clipboard).toContain('--spacing-md: 16px;');
  expect(clipboard).toContain('--font-size-lg: 24px;');
});

test('Download Audit JSON exports token checks and the live HTML audit', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Audit JSON' }).click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('a11y-lens-token-audit.json');
  const path = await download.path();
  expect(path).not.toBeNull();
  const report = JSON.parse(await readFile(path!, 'utf8'));

  expect(report.requiredRatios.normalText).toBe(4.5);
  expect(report.contrastSummary).toEqual({ passed: 3, failed: 1, skipped: 0 });
  expect(report.validation).toEqual([]);
  expect(report.htmlAudit.summary.errors).toBeGreaterThan(0);
});

test('edits are preserved when switching between the editor tabs', async ({ page }) => {
  const editor = page.getByTestId('token-json-editor');
  const json = await editor.inputValue();
  await editor.fill(json.replace('#CBD5E1', '#000000'));

  await page.getByRole('tab', { name: 'HTML Editor' }).click();
  await expect(page.locator('#snippet-editor')).toBeVisible();

  await page.getByRole('tab', { name: 'Design Tokens' }).click();
  await expect(page.getByTestId('token-json-editor')).toContainText('#000000');
});
