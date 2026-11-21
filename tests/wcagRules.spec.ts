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
  await expect(page.getByTestId('audit-report')).toBeVisible();
});

test('report exposes deterministic and axe-backed WCAG coverage', async ({ page }) => {
  const ruleCount = page.getByTestId('audit-rule-count');
  await expect(ruleCount).toContainText(/Checked \d+\/\d+ WCAG rules/);

  // The sandbox axe run expands coverage beyond the eight deterministic rules.
  await expect
    .poll(async () => {
      const text = (await ruleCount.textContent()) ?? '';
      return Number(text.match(/Checked \d+\/(\d+)/)?.[1] ?? 0);
    })
    .toBeGreaterThan(8);
});

test('passed rule badges stay compact behind an expandable overflow pill', async ({ page }) => {
  const overflow = page.getByTestId('audit-passed-overflow');
  await expect(overflow).toBeVisible();
  await expect(overflow).toContainText(/\+\d+ more/);

  const collapsedCount = await page.getByTestId('audit-passed-rule').count();
  expect(collapsedCount).toBeLessThanOrEqual(4);

  await overflow.click();
  await expect(overflow).toHaveText('Show less');
  await expect(overflow).toHaveAttribute('aria-expanded', 'true');
  expect(await page.getByTestId('audit-passed-rule').count()).toBeGreaterThan(collapsedCount);
});

test('vague links, positive tabindex, focus suppression and form controls are flagged', async ({
  page,
}) => {
  await page.locator('#snippet-editor').fill(
    '<main style="background-color: #ffffff; padding: 16px;">' +
      '<h1 style="color: #111827;">Keyboard check</h1>' +
      '<a href="#" style="color: #1d4ed8;">Click here</a>' +
      '<button tabindex="3" class="outline-none" style="color: #111827; background-color: #ffffff;">Action</button>' +
      '<select style="color: #111827; background-color: #ffffff;"></select>' +
      '<textarea style="color: #111827; background-color: #ffffff;"></textarea>' +
      '</main>',
  );

  await expect(page.getByTestId('preview-issue-badge')).toHaveText('5 issues');
  expect(await ruleCount(page, 'vague-link-text')).toBe(1);
  expect(await ruleCount(page, 'positive-tabindex')).toBe(1);
  expect(await ruleCount(page, 'focus-outline')).toBe(1);
  expect(await ruleCount(page, 'form-label')).toBe(2);
});

test('a focus-visible replacement suppresses the focus-outline finding', async ({ page }) => {
  await page.locator('#snippet-editor').fill(
    '<main style="background-color: #ffffff; padding: 16px;">' +
      '<button class="outline-none focus-visible:outline-2" style="color: #111827; background-color: #ffffff;">Action</button>' +
      '</main>',
  );
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('0 issues');
});

test('zero violations reports full X/X WCAG rule coverage', async ({ page }) => {
  // Axe best-practice findings that are intentionally not surfaced as issues
  // (e.g. landmark-one-main on a fragment) must not count as failed rules.
  await page.locator('#snippet-editor').fill(
    '<div style="color:#111827;background-color:#ffffff;">Just text</div>',
  );
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('0 issues');

  // Wait for the iframe axe snapshot so the count covers axe-backed rules too.
  const ruleCount = page.getByTestId('audit-rule-count');
  await expect
    .poll(async () => {
      const text = (await ruleCount.textContent()) ?? '';
      return Number(text.match(/Checked \d+\/(\d+)/)?.[1] ?? 0);
    })
    .toBeGreaterThan(8);

  const text = (await ruleCount.textContent()) ?? '';
  const match = /Checked (\d+)\/(\d+) WCAG rules/.exec(text);
  expect(match, `Expected an X/X rule count, got "${text}"`).not.toBeNull();
  const passedCount = Number(match?.[1]);
  const totalRulesCount = Number(match?.[2]);
  expect(passedCount, 'passedCount === totalRulesCount when violations.length === 0').toBe(
    totalRulesCount,
  );
});

test('multiple h1 headings are reported', async ({ page }) => {
  await page.locator('#snippet-editor').fill(
    '<main style="background-color: #ffffff; padding: 16px;">' +
      '<h1 style="color: #111827;">First</h1>' +
      '<h1 style="color: #111827;">Second</h1>' +
      '</main>',
  );
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('1 issue');
  expect(await ruleCount(page, 'heading-order')).toBe(1);
  await expect(page.getByTestId('audit-issue-list')).toContainText('more than one h1');
});
