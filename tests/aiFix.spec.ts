import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('audit-report')).toBeVisible();
});

test('demo AI fix generates diff and applies patch to editor', async ({ page }) => {
  await page.getByRole('button', { name: 'AI Fix' }).click();
  const drawer = page.getByTestId('ai-fix-drawer');
  await expect(drawer).toBeVisible();

  await page.getByTestId('demo-ai-fix-button').click();
  await expect(page.getByTestId('ai-fix-result')).toBeVisible();
  await expect(page.getByTestId('ai-fix-diff')).toBeVisible();
  await expect(drawer).toContainText('Demo fix');

  const editor = page.locator('#snippet-editor');
  const before = await editor.inputValue();
  expect(before).not.toContain('alt="Team collaborating in an office"');

  await page.getByTestId('apply-ai-fix-button').click();
  await expect(drawer).toBeHidden();
  await expect(editor).toContainText('alt="Team collaborating in an office"');
  await expect(page.getByTestId('preview-issue-badge')).not.toHaveText('3 issues');
});

test('BYOK request shows an animated spinner and a polite progress message', async ({ page }) => {
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');
  await page.getByTestId('openrouter-key-input').fill('sk-or-test-session-only');

  await page.route('https://openrouter.ai/api/v1/chat/completions', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        choices: [{ message: { content: '<main><h1>Accessible title</h1></main>' } }],
      }),
    });
  });

  const generate = page.getByTestId('generate-ai-fix-button');
  await expect(generate).toContainText('Generate Fix with OpenRouter');
  await generate.click();

  const status = page.getByTestId('ai-fix-loading-status');
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toContainText('Generating a WCAG fix with OpenRouter');
  await expect(generate).toContainText('Generating WCAG Fix...');
  await expect(generate.locator('svg.animate-spin')).toBeVisible();
  await expect(page.getByTestId('apply-ai-fix-button')).toBeDisabled();

  await expect(status).toBeHidden();
  await expect(page.getByTestId('ai-fix-result')).toBeVisible();
});

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const OPENROUTER_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

test('closing the AI drawer mid-request aborts cleanly and reopening is idle', async ({ page }) => {
  await page.route(OPENROUTER_MODELS_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });
  await page.route(OPENROUTER_COMPLETIONS_URL, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: '<main><h1>Late response</h1></main>' } }],
        }),
      });
    } catch {
      // Expected: the page aborted this fetch when the drawer closed.
    }
  });

  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');
  await page.getByTestId('openrouter-key-input').fill('sk-or-test-session-only');
  await page.getByTestId('generate-ai-fix-button').click();
  await expect(page.getByTestId('ai-fix-loading-status')).toBeVisible();

  await page.getByRole('button', { name: 'Close AI fix drawer' }).click();
  await expect(page.getByTestId('ai-fix-drawer')).toBeHidden();

  // Let the aborted response settle; it must not flip the preserved state.
  await page.waitForTimeout(1700);
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await expect(page.getByTestId('ai-fix-drawer')).toBeVisible();
  await expect(page.getByTestId('ai-fix-loading-status')).toHaveCount(0);
  await expect(page.getByTestId('ai-fix-error')).toHaveCount(0);
  await expect(page.getByTestId('ai-fix-result')).toHaveCount(0);
  await expect(page.getByTestId('generate-ai-fix-button')).toBeEnabled();

  // Re-triggering after the abort still works.
  await page.getByTestId('demo-ai-fix-button').click();
  await expect(page.getByTestId('ai-fix-result')).toBeVisible();
});

test('a superseded slow request cannot overwrite the newer AI fix result', async ({ page }) => {
  await page.route(OPENROUTER_MODELS_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });

  let callCount = 0;
  await page.route(OPENROUTER_COMPLETIONS_URL, async (route) => {
    callCount += 1;
    if (callCount === 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{ message: { content: '<main><h1>Stale response</h1></main>' } }],
          }),
        });
      } catch {
        // Expected: this fetch was aborted when the drawer closed.
      }
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content: '<main><h1>Fresh response</h1></main>' } }],
      }),
    });
  });

  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');
  await page.getByTestId('openrouter-key-input').fill('sk-or-test-session-only');
  await page.getByTestId('generate-ai-fix-button').click();
  await expect(page.getByTestId('ai-fix-loading-status')).toBeVisible();

  // Abort request #1 by closing the drawer, then issue request #2 after reopening.
  await page.getByRole('button', { name: 'Close AI fix drawer' }).click();
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('generate-ai-fix-button').click();

  const result = page.getByTestId('ai-fix-result');
  await expect(result).toContainText('Fresh response');

  // The late response from #1 must not replace #2's result.
  await page.waitForTimeout(1700);
  await expect(result).toContainText('Fresh response');
  await expect(result).not.toContainText('Stale response');
  await expect(page.getByTestId('ai-fix-error')).toHaveCount(0);
  expect(callCount).toBe(2);
});

test('BYOK settings are stored in sessionStorage only', async ({ page }) => {
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');
  await page.getByTestId('openrouter-key-input').fill('sk-or-test-session-only');
  await page.getByTestId('openrouter-model-select').selectOption('__custom__');
  await page.getByTestId('openrouter-custom-model-input').fill('openai/gpt-4.1-mini');

  const stored = await page.evaluate(() => ({
    provider: window.sessionStorage.getItem('a11y-lens.ai.provider'),
    key: window.sessionStorage.getItem('a11y-lens.ai.openrouter.key'),
    model: window.sessionStorage.getItem('a11y-lens.ai.openrouter.model'),
    localProvider: window.localStorage.getItem('a11y-lens.ai.provider'),
    localKey: window.localStorage.getItem('a11y-lens.ai.openrouter.key'),
  }));

  expect(stored.provider).toContain('openrouter');
  expect(stored.key).toContain('sk-or-test-session-only');
  expect(stored.model).toContain('openai/gpt-4.1-mini');
  expect(stored.localProvider).toBeNull();
  expect(stored.localKey).toBeNull();
});
