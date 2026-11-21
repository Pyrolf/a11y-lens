import { expect, test, type Page } from '@playwright/test';

const MODELS_URL = 'https://openrouter.ai/api/v1/models';
const COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';
const ROTATED_FREE_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';

async function stubEmptyCatalog(page: Page): Promise<void> {
  await page.route(MODELS_URL, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });
}

async function openOpenRouterSettings(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');
  await page.getByTestId('openrouter-key-input').fill('sk-or-test-session-only');
}

test('free model dropdown hides congested families and pins the auto-router first', async ({ page }) => {
  const zeroPriced = { prompt: '0', completion: '0' };
  const free = (id: string) => ({ id, pricing: zeroPriced });

  await page.route(MODELS_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          free('google/gemma-3-27b-it:free'),
          free('inclusionai/Ling-2.0:free'),
          free('recursive/recursive-1.1:free'),
          free('cohere/command-r-08-2024:free'),
          free('liquid/lfm-3-1.7b:free'),
          free('nvidia/nemotron-3.5-lightning:free'),
          { id: 'anthropic/claude-3.5-sonnet', pricing: { prompt: '3', completion: '15' } },
        ],
      }),
    });
  });

  await openOpenRouterSettings(page);

  const modelSelect = page.getByTestId('openrouter-model-select');
  const options = await modelSelect.locator('option').evaluateAll((elements) =>
    elements.map((element) => {
      const option = element as HTMLOptionElement;
      return { value: option.value, label: option.textContent?.trim() ?? '' };
    }),
  );
  const values = options.map((option) => option.value);

  expect(values[0]).toBe('openrouter/free');
  expect(options[0]?.label).toContain('Free Models Auto-Router (Recommended)');
  expect(values).not.toContain('google/gemma-3-27b-it:free');
  expect(values).not.toContain('inclusionai/Ling-2.0:free');
  expect(values).toEqual(
    expect.arrayContaining([
      'nvidia/nemotron-3.5-lightning:free',
      'cohere/command-r-08-2024:free',
      'liquid/lfm-3-1.7b:free',
      'recursive/recursive-1.1:free',
    ]),
  );
  expect(values.at(-1)).toBe('__custom__');
  await expect(modelSelect).toHaveValue('openrouter/free');

  // The escape hatch still accepts any manually typed slug, including filtered families.
  await modelSelect.selectOption('__custom__');
  await page.getByTestId('openrouter-custom-model-input').fill('google/gemma-3-27b-it:free');
  expect(await page.evaluate(() => window.sessionStorage.getItem('a11y-lens.ai.openrouter.model'))).toContain(
    'google/gemma-3-27b-it:free',
  );
});

test('a 429 on an individual free model retries once with the openrouter/free auto-router', async ({ page }) => {
  await stubEmptyCatalog(page);
  const requestedModels: string[] = [];

  await page.route(COMPLETIONS_URL, async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { model?: string };
    requestedModels.push(body.model ?? '');
    if (body.model === ROTATED_FREE_MODEL) {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'retry-after': '30' },
        body: JSON.stringify({ error: { message: 'Rate limit exceeded', type: 'rate_limit_exceeded' } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content: '<main><h1>Accessible title</h1></main>' } }],
      }),
    });
  });

  await openOpenRouterSettings(page);
  await page.getByTestId('openrouter-model-select').selectOption('__custom__');
  await page.getByTestId('openrouter-custom-model-input').fill(ROTATED_FREE_MODEL);
  await page.getByTestId('generate-ai-fix-button').click();

  const result = page.getByTestId('ai-fix-result');
  await expect(result).toBeVisible();
  expect(requestedModels).toEqual([ROTATED_FREE_MODEL, 'openrouter/free']);
  await expect(result).toContainText('OpenRouter (openrouter/free)');
  await expect(result).toContainText('rate limited (429)');
  await expect(page.getByTestId('ai-fix-error')).toHaveCount(0);
});

test('429 on both the free model and the auto-router offers a one-click demo fix', async ({ page }) => {
  await stubEmptyCatalog(page);
  const requestedModels: string[] = [];

  await page.route(COMPLETIONS_URL, async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { model?: string };
    requestedModels.push(body.model ?? '');
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Rate limit exceeded', type: 'rate_limit_exceeded' } }),
    });
  });

  await openOpenRouterSettings(page);
  await page.getByTestId('openrouter-model-select').selectOption('__custom__');
  await page.getByTestId('openrouter-custom-model-input').fill(ROTATED_FREE_MODEL);
  await page.getByTestId('generate-ai-fix-button').click();

  const error = page.getByTestId('ai-fix-error');
  await expect(error).toBeVisible();
  expect(requestedModels).toEqual([ROTATED_FREE_MODEL, 'openrouter/free']);
  await expect(error).toContainText('429');
  await expect(error).toContainText('rate limit');
  await expect(error).toContainText('openrouter/free');
  await expect(error).toContainText('Try Demo AI Fix (No Key Required)');

  const inlineDemoButton = error.getByRole('button', { name: 'Try Demo AI Fix (No Key Required)' });
  await expect(inlineDemoButton).toBeVisible();
  await inlineDemoButton.click();

  await expect(page.getByTestId('ai-fix-result')).toBeVisible();
  await expect(page.getByTestId('ai-fix-error')).toHaveCount(0);
  await expect(page.getByTestId('ai-provider-select')).toHaveValue('demo');
});

test('a rate-limited pinned auto-router shows the demo fallback without a redundant retry', async ({ page }) => {
  await stubEmptyCatalog(page);
  const requestedModels: string[] = [];

  await page.route(COMPLETIONS_URL, async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { model?: string };
    requestedModels.push(body.model ?? '');
    await route.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"rate limited"}' });
  });

  await openOpenRouterSettings(page);
  await expect(page.getByTestId('openrouter-model-select')).toHaveValue('openrouter/free');
  await page.getByTestId('generate-ai-fix-button').click();

  const error = page.getByTestId('ai-fix-error');
  await expect(error).toContainText('429');
  await expect(error.getByTestId('rate-limit-demo-fix-button')).toBeVisible();
  expect(requestedModels).toEqual(['openrouter/free']);
});
