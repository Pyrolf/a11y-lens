import { expect, test } from '@playwright/test';

/**
 * Regression guard for the production-only axe-core failure: raw interpolation
 * into the sandbox srcDoc can close the inline script early, and Vite rewrites
 * the imported `axe.source` UMD wrapper. Either way axe silently disappeared and
 * the audit fell back to the eight deterministic rules. This spec runs against
 * `vite preview`, not the dev server.
 */
test('production build loads axe-core in the sandbox and expands WCAG coverage', async ({
  page,
}) => {
  await page.goto('/');

  const ruleCount = page.getByTestId('audit-rule-count');
  await expect(ruleCount).toContainText(/Checked \d+\/\d+ WCAG rules/);

  // axe must be present in the opaque-origin iframe with its full source.
  const sandbox = page.frames().find((frame) => frame !== page.mainFrame());
  expect(sandbox, 'sandbox preview frame should exist').toBeTruthy();
  if (!sandbox) return;

  await expect
    .poll(async () => sandbox.evaluate(() => typeof (window as Window & { axe?: unknown }).axe))
    .toBe('object');

  const axeSourceLength = await sandbox.evaluate(
    () => document.querySelector('script[data-a11y-lens-axe-source]')?.textContent?.length ?? 0,
  );
  expect(axeSourceLength, 'full axe source should be injected at runtime').toBeGreaterThan(100_000);

  // The fallback reports only the eight deterministic rules. A healthy axe run
  // contributes many more evaluated rules to the audit summary.
  await expect
    .poll(async () => {
      const text = (await ruleCount.textContent()) ?? '';
      return Number(text.match(/Checked \d+\/(\d+)/)?.[1] ?? 0);
    })
    .toBeGreaterThan(15);
});
