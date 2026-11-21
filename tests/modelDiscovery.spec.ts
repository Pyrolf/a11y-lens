import { expect, test, type Page } from '@playwright/test';

const CONNECTED_LABEL = 'Installed local models (Detected)';
const SUGGESTED_LABEL = 'Suggested models (Ollama not connected)';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const OPENROUTER_LIVE_LABEL = 'Free models (Live catalog)';
const OPENROUTER_CACHED_LABEL = 'Free models (Cached catalog)';
const OPENROUTER_FALLBACK_LABEL = 'Suggested free models (Catalog unavailable)';

async function expectOneOllamaGroup(page: Page, label: string): Promise<void> {
  const modelSelect = page.getByTestId('ollama-model-select');
  await expect(modelSelect.locator('optgroup')).toHaveCount(1);
  await expect(modelSelect.locator('optgroup')).toHaveAttribute('label', label);
  await expect(modelSelect.locator('> option[value="__ollama_custom__"]')).toHaveCount(1);
  await expect(modelSelect.locator('optgroup option[value="__ollama_custom__"]')).toHaveCount(0);
}

async function expectOneOpenRouterGroup(page: Page, label: string): Promise<void> {
  const modelSelect = page.getByTestId('openrouter-model-select');
  await expect(modelSelect.locator('optgroup')).toHaveCount(1);
  await expect(modelSelect.locator('optgroup')).toHaveAttribute('label', label);
  await expect(modelSelect.locator('> option[value="__custom__"]')).toHaveCount(1);
  await expect(modelSelect.locator('optgroup option[value="__custom__"]')).toHaveCount(0);
}

async function openOllamaSettings(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('ollama');
}

test('connected Ollama renders exactly one detected optgroup plus one custom option', async ({ page }) => {
  await page.route('**/api/tags', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ models: [{ name: 'llama3.2:latest' }] }),
    });
  });

  await openOllamaSettings(page);
  await expect(page.getByTestId('ollama-model-source')).toHaveText(CONNECTED_LABEL);
  await expectOneOllamaGroup(page, CONNECTED_LABEL);
  await expect(page.getByTestId('ollama-model-select').locator('optgroup')).toHaveCount(1);
});

test('offline Ollama renders exactly one suggested optgroup plus one custom option', async ({ page }) => {
  await page.route('**/api/tags', async (route) => {
    await route.abort('failed');
  });

  await openOllamaSettings(page);
  await expect(page.getByTestId('ollama-model-source')).toHaveText(SUGGESTED_LABEL);
  await expectOneOllamaGroup(page, SUGGESTED_LABEL);
  await expect(page.getByTestId('ollama-model-select').locator('optgroup')).toHaveCount(1);
});

test('rapid Ollama URL typing issues a single debounced discovery request', async ({ page }) => {
  const tagRequests: string[] = [];
  await page.route('**/api/tags', async (route) => {
    tagRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ models: [] }),
    });
  });

  await openOllamaSettings(page);
  await expect(page.getByTestId('ollama-model-source')).toHaveText(SUGGESTED_LABEL);
  const beforeTyping = tagRequests.length;

  const urlInput = page.getByTestId('ollama-base-url-input');
  await urlInput.click();
  await urlInput.press('ControlOrMeta+A');
  await urlInput.pressSequentially('http://localhost:12345', { delay: 10 });

  // Every keystroke would otherwise fire a request; only the settled URL should.
  await expect.poll(() => tagRequests.length).toBe(beforeTyping + 1);
  await page.waitForTimeout(500);
  expect(tagRequests.length).toBe(beforeTyping + 1);
});

test('live OpenRouter discovery renders one grouped section plus one custom option', async ({ page }) => {
  await page.route(OPENROUTER_MODELS_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'qwen/qwen3-coder:free',
            name: 'Qwen3 Coder',
            context_length: 262_144,
            pricing: { prompt: '0', completion: '0' },
          },
        ],
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');

  await expect(page.getByTestId('openrouter-model-hint')).toContainText('Smart-ranked $0 models');
  await expectOneOpenRouterGroup(page, OPENROUTER_LIVE_LABEL);
  await expect(
    page.getByTestId('openrouter-model-select').locator('optgroup option[value="qwen/qwen3-coder:free"]'),
  ).toHaveCount(1);
});

test('unreachable OpenRouter catalog renders one suggested group and the offline hint', async ({ page }) => {
  await page.route(OPENROUTER_MODELS_URL, async (route) => {
    await route.abort('failed');
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');

  await expect(page.getByTestId('openrouter-model-hint')).toContainText('Live catalog unavailable');
  await expectOneOpenRouterGroup(page, OPENROUTER_FALLBACK_LABEL);
  await expect(
    page.getByTestId('openrouter-model-select').locator('option[value="openrouter/free"]'),
  ).toHaveCount(1);
});

test('reopening the drawer uses the cached OpenRouter catalog with one grouped section', async ({ page }) => {
  let catalogRequests = 0;
  await page.route(OPENROUTER_MODELS_URL, async (route) => {
    catalogRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'qwen/qwen3-coder:free',
            name: 'Qwen3 Coder',
            context_length: 262_144,
            pricing: { prompt: '0', completion: '0' },
          },
        ],
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');
  await expect(page.getByTestId('openrouter-model-hint')).toContainText('Smart-ranked $0 models');
  await expectOneOpenRouterGroup(page, OPENROUTER_LIVE_LABEL);

  const requestsAfterFirstOpen = catalogRequests;
  await page.getByRole('button', { name: 'Close AI fix drawer' }).click();
  await page.getByRole('button', { name: 'AI Fix' }).click();

  await expect(page.getByTestId('openrouter-model-hint')).toContainText(
    'Using the cached OpenRouter catalog',
  );
  await expectOneOpenRouterGroup(page, OPENROUTER_CACHED_LABEL);
  // A cache hit must not issue another catalog request.
  expect(catalogRequests).toBe(requestsAfterFirstOpen);
});
