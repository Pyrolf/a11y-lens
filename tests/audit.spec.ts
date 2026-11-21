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

test('sample snippet is audited live in the sandboxed workbench', async ({ page }) => {
  const issues = page.getByTestId('audit-issue-list').locator('li');
  await expect(issues).toHaveCount(3);
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('3 issues');
  expect(await ruleCount(page, 'image-alt')).toBe(1);
  expect(await ruleCount(page, 'accessible-name')).toBe(1);
  expect(await ruleCount(page, 'heading-order')).toBe(1);
  await expect(page.locator('iframe[title="Snippet preview sandbox"]')).toBeVisible();
  await expect(page.getByTestId('sandbox-preview-frame')).toHaveAttribute('sandbox', 'allow-scripts');
});

test('workbench exposes skip navigation and announces audit counts', async ({ page }) => {
  await expect(page.getByTestId('audit-status')).toContainText(
    '3 issues found: 2 errors, 1 warning, 0 info',
  );
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
});

test('viewport switcher applies distinct reflow widths and active labels', async ({ page }) => {
  const frame = page.getByTestId('sandbox-preview-frame');
  const badge = page.getByTestId('viewport-width-badge');
  const stage = frame.locator('..');

  await expect(badge).toHaveText('Desktop · Full width');
  await expect(frame).toHaveClass(/\bw-full\b/);
  await expect(frame).not.toHaveClass(/min-w-\[1024px\]/);
  await expect
    .poll(() =>
      frame.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const parent = node.parentElement?.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          parentWidth: Math.round(parent?.width ?? 0),
          scrollWidth: node.parentElement?.scrollWidth ?? 0,
          clientWidth: node.parentElement?.clientWidth ?? 0,
        };
      }),
    )
    .toEqual(expect.objectContaining({ scrollWidth: expect.any(Number), clientWidth: expect.any(Number) }));
  await expect
    .poll(() =>
      frame.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const parent = node.parentElement;
        const parentWidth = parent?.getBoundingClientRect().width ?? 0;
        return (
          rect.width > 0 &&
          rect.width <= parentWidth &&
          (parent?.scrollWidth ?? 0) <= (parent?.clientWidth ?? 0) + 1
        );
      }),
    )
    .toBe(true);

  await page.getByRole('button', { name: 'Tablet' }).click();
  await expect(badge).toHaveText('Tablet · 768px');
  await expect(frame).toHaveClass(/\bw-full\b/);
  await expect(frame).toHaveClass(/max-w-\[768px\]/);
  await expect(frame).toHaveClass(/rounded-xl/);
  await expect
    .poll(() =>
      frame.evaluate((node) => {
        const width = Math.round(node.getBoundingClientRect().width);
        const parent = node.parentElement;
        const parentWidth = Math.round((parent?.clientWidth ?? 0) - 32); // p-4 stage padding
        return width > 0 && width <= 768 && width <= parentWidth + 1 && width >= Math.min(768, parentWidth) - 1;
      }),
    )
    .toBe(true);
  await expect
    .poll(() =>
      frame.evaluate((node) => (node.parentElement?.scrollWidth ?? 0) <= (node.parentElement?.clientWidth ?? 0) + 1),
    )
    .toBe(true);

  await page.getByRole('button', { name: 'Mobile' }).click();
  await expect(badge).toHaveText('Mobile · 375px');
  await expect(frame).toHaveClass(/\bw-full\b/);
  await expect(frame).toHaveClass(/max-w-\[375px\]/);
  await expect(frame).toHaveClass(/rounded-2xl/);
  await expect
    .poll(() =>
      frame.evaluate((node) => {
        const width = Math.round(node.getBoundingClientRect().width);
        const parent = node.parentElement;
        const parentWidth = Math.round((parent?.clientWidth ?? 0) - 32); // p-4 stage padding
        return width > 0 && width <= 375 && width <= parentWidth + 1 && width >= Math.min(375, parentWidth) - 1;
      }),
    )
    .toBe(true);
  await expect
    .poll(() =>
      frame.evaluate((node) => (node.parentElement?.scrollWidth ?? 0) <= (node.parentElement?.clientWidth ?? 0) + 1),
    )
    .toBe(true);

  await expect(stage).toHaveClass(/overflow-x-auto/);
});

test('Low Contrast Hero preset reports skipped heading and failing inline pairs', async ({ page }) => {
  await page.getByRole('button', { name: 'Load broken preset: Low Contrast Hero' }).click();
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('3 issues');
  expect(await ruleCount(page, 'color-contrast')).toBe(2);
  expect(await ruleCount(page, 'heading-order')).toBe(1);
  await expect(page.getByTestId('audit-issue-list')).toContainText('required 4.5:1');
});

test('Inaccessible Form preset reports missing labels and names', async ({ page }) => {
  await page.getByRole('button', { name: 'Load broken preset: Inaccessible Form' }).click();
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('5 issues');
  expect(await ruleCount(page, 'accessible-name')).toBe(2);
  expect(await ruleCount(page, 'form-label')).toBe(2);
  expect(await ruleCount(page, 'image-alt')).toBe(1);
});

test('Broken Modal preset reports all deterministic rule families', async ({ page }) => {
  await page.getByRole('button', { name: 'Load broken preset: Broken Modal' }).click();
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('5 issues');
  expect(await ruleCount(page, 'image-alt')).toBe(1);
  expect(await ruleCount(page, 'accessible-name')).toBe(1);
  expect(await ruleCount(page, 'heading-order')).toBe(1);
  expect(await ruleCount(page, 'color-contrast')).toBe(2);
});

test('switching presets replaces the audit and clears stale selections', async ({ page }) => {
  const starter = await page.locator('#snippet-editor').inputValue();
  await page.getByRole('button', { name: 'Load broken preset: Inaccessible Form' }).click();
  await page.getByRole('checkbox').first().check();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await expect(page.locator('#snippet-editor')).not.toHaveValue(starter);

  await page.getByRole('button', { name: 'Load broken preset: Low Contrast Hero' }).click();
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('3 issues');
  await expect(page.getByRole('checkbox').first()).not.toBeChecked();
  expect(await ruleCount(page, 'form-label')).toBe(0);
  expect(await ruleCount(page, 'color-contrast')).toBe(2);

  await page.getByRole('button', { name: 'Load default preset: Default / Starter' }).click();
  await expect(page.locator('#snippet-editor')).toHaveValue(starter);
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('3 issues');
});

test('rapid preset switching settles on the final snapshot without stale audits', async ({ page }) => {
  const editor = page.locator('#snippet-editor');
  const loadForm = page.getByRole('button', { name: 'Load broken preset: Inaccessible Form' });
  const loadModal = page.getByRole('button', { name: 'Load broken preset: Broken Modal' });
  const loadHero = page.getByRole('button', { name: 'Load broken preset: Low Contrast Hero' });
  const loadStarter = page.getByRole('button', { name: 'Load default preset: Default / Starter' });

  // Click faster than the 250ms live-analysis debounce and the iframe reload cycle.
  await loadForm.click();
  await loadModal.click();
  await loadHero.click();
  await loadStarter.click();
  await loadModal.click();

  await expect(editor).toHaveValue(/Delete this project\?/);
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('5 issues');
  expect(await ruleCount(page, 'image-alt')).toBe(1);
  expect(await ruleCount(page, 'color-contrast')).toBe(2);
  expect(await ruleCount(page, 'heading-order')).toBe(1);
  expect(await ruleCount(page, 'form-label')).toBe(0);
  expect(await ruleCount(page, 'vague-link-text')).toBe(0);

  // Extracted tokens must come from the final frame, not a stale earlier snapshot.
  await page.getByRole('button', { name: 'Extracted Tokens' }).click();
  const tokenList = page.getByTestId('extracted-token-list');
  await expect(tokenList).toContainText('#BBBBBB');
  await expect(tokenList).not.toContainText('#CCCCCC');
  await expect(tokenList).not.toContainText('#4F46E5');
});

test('rapid editor updates settle on the last snippet without stale snapshot styles', async ({ page }) => {
  const editor = page.locator('#snippet-editor');

  await editor.fill('<main style="background-color: #ffffff; color: #111827;"><h1>First</h1></main>');
  await editor.fill(
    '<main style="background-color: #ffffff; color: #111827;"><h1>Second</h1><img src="x.png" /></main>',
  );
  await editor.fill('<main style="background-color: #ffffff; color: #111827;"><h1>Final</h1></main>');

  await expect(editor).toHaveValue(/Final/);
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('0 issues');
  await expect(page.getByTestId('audit-report')).toContainText('No issues found.');
});

test('report updates live when the editor content is fixed', async ({ page }) => {
  await page.getByRole('button', { name: 'Load broken preset: Low Contrast Hero' }).click();
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('3 issues');

  await page.locator('#snippet-editor').fill(
    '<main style="background-color: #ffffff;"><h1 style="color: #111827;">All good</h1></main>',
  );

  await expect(page.getByTestId('preview-issue-badge')).toHaveText('0 issues');
  await expect(page.getByTestId('audit-report')).toContainText('No issues found.');
  await expect(page.getByTestId('audit-status')).toContainText('0 issues found');
});

test('authored tokens are snippet-only, transparent-free and show usage counts', async ({ page }) => {
  await page.locator('#snippet-editor').fill(
    '<main style="background-color: #ffffff; color: #111827; padding: 16px;">' +
      '<p>First</p><p>Second</p>' +
      '<span style="background-color: rgba(0, 0, 0, 0);">Decorative</span>' +
      '</main>',
  );
  await page.getByRole('button', { name: 'Extracted Tokens' }).click();

  const tokenList = page.getByTestId('extracted-token-list');
  await expect(tokenList).not.toContainText('effective-background-color');
  await expect(tokenList).not.toContainText('rgba(0, 0, 0, 0)');
  await expect(tokenList).not.toContainText('rgb(15, 23, 42)');
  // The explicit declaration is on <main>; the children's inherited colors are hidden.
  await expect(tokenList).not.toContainText('Text Color');
  await expect(page.getByTestId('inherited-badge')).toHaveCount(0);

  const authoredTextColor = page
    .getByTestId('extracted-token')
    .filter({ hasText: 'color' })
    .filter({ hasText: '#111827' });
  await expect(authoredTextColor.getByTestId('token-value')).toHaveText('#111827');
  await expect(authoredTextColor).toContainText('rgb(17, 24, 39)');
  await expect(authoredTextColor.getByTestId('token-usage-badge')).toHaveText('2 elements');

  const backgroundColor = page
    .getByTestId('extracted-token')
    .filter({ hasText: 'background-color' })
    .filter({ hasText: '#FFFFFF' });
  await expect(backgroundColor).toContainText('rgb(255, 255, 255)');
  await expect(backgroundColor.getByTestId('token-usage-badge')).toHaveText('2 elements');
});

test('Design Token validation reports pass/fail AA pairs from the sample document', async ({ page }) => {
  await page.getByRole('tab', { name: 'Design Tokens' }).click();
  await expect(page.getByTestId('token-validation')).toContainText('JSON valid');
  await expect(page.getByTestId('color-token')).toHaveCount(8);
  await expect(page.getByTestId('contrast-check')).toHaveCount(4);
  await expect(page.getByTestId('contrast-badge').filter({ hasText: 'PASS' })).toHaveCount(3);
  await expect(page.getByTestId('contrast-badge').filter({ hasText: 'FAIL' })).toHaveCount(1);
  await expect(page.getByTestId('contrast-check-list')).toContainText('1.48:1');
});

test('Design Token validation flags invalid hex and malformed JSON', async ({ page }) => {
  await page.getByRole('tab', { name: 'Design Tokens' }).click();
  const editor = page.getByTestId('token-json-editor');

  await editor.fill((await editor.inputValue()).replace('"#FFFFFF"', '"#GGGGGG"'));
  await expect(page.getByTestId('token-validation')).toContainText('hex color');
  await expect(page.getByTestId('invalid-hex-badge')).toHaveCount(1);

  await editor.fill('{"color": {');
  await expect(page.getByTestId('token-validation')).toContainText('Invalid JSON');
  await expect(page.getByTestId('copy-css-variables')).toBeDisabled();
});

test('Design Token validation updates when a failing pair is corrected', async ({ page }) => {
  await page.getByRole('tab', { name: 'Design Tokens' }).click();
  const editor = page.getByTestId('token-json-editor');
  await editor.fill((await editor.inputValue()).replace('"#CBD5E1"', '"#000000"'));

  await expect(page.getByTestId('token-validation')).toContainText('JSON valid');
  await expect(page.getByTestId('contrast-badge').filter({ hasText: 'PASS' })).toHaveCount(4);
  await expect(page.getByTestId('contrast-badge').filter({ hasText: 'FAIL' })).toHaveCount(0);
});

test('demo AI fix repairs the Low Contrast Hero preset down to zero violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Load broken preset: Low Contrast Hero' }).click();

  const issues = page.getByTestId('audit-issue-list').locator('li');
  await expect(page.locator('iframe[title="Snippet preview sandbox"]')).toBeVisible();
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('3 issues');
  await expect(issues).toHaveCount(3);
  await expect(page.getByRole('checkbox', { name: 'Select issue Heading level jumps from h1 to h3.' })).toBeVisible();
  expect(await ruleCount(page, 'heading-order')).toBe(1);
  expect(await ruleCount(page, 'color-contrast')).toBe(2);

  await page.getByRole('button', { name: 'AI Fix' }).click();
  await expect(page.getByTestId('ai-fix-drawer')).toBeVisible();
  await page.getByRole('button', { name: 'Try Demo AI Fix (No Key Required)' }).click();
  await expect(page.getByTestId('ai-fix-result')).toBeVisible();
  await expect(page.getByTestId('ai-fix-diff')).toContainText('color: #111827');
  await page.getByTestId('apply-ai-fix-button').click();

  await expect(page.getByTestId('ai-fix-drawer')).toBeHidden();
  await expect(page.locator('#snippet-editor')).toContainText(
    '<h2 style="color: #111827; margin-top: 8px;">Why teams choose A11y Lens</h2>',
  );
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('0 issues');
  await expect(issues).toHaveCount(0);
});

const demoFixPresets = [
  { label: 'Default / Starter', loadButton: 'Load default preset: Default / Starter' },
  { label: 'Low Contrast Hero', loadButton: 'Load broken preset: Low Contrast Hero' },
  { label: 'Inaccessible Form', loadButton: 'Load broken preset: Inaccessible Form' },
  { label: 'Broken Modal', loadButton: 'Load broken preset: Broken Modal' },
];

for (const preset of demoFixPresets) {
  test(`Try Demo AI Fix clears every WCAG violation in the ${preset.label} preset`, async ({ page }) => {
    await page.getByRole('button', { name: preset.loadButton }).click();
    await expect(page.locator('iframe[title="Snippet preview sandbox"]')).toBeVisible();
    await expect
      .poll(async () => Number((await page.getByTestId('preview-issue-badge').textContent())?.match(/\d+/)?.[0] ?? 0))
      .toBeGreaterThan(0);

    await page.getByRole('button', { name: 'AI Fix' }).click();
    await expect(page.getByTestId('ai-fix-drawer')).toBeVisible();
    await page.getByRole('button', { name: 'Try Demo AI Fix (No Key Required)' }).click();
    await expect(page.getByTestId('ai-fix-result')).toBeVisible();
    await page.getByTestId('apply-ai-fix-button').click();

    await expect(page.getByTestId('ai-fix-drawer')).toBeHidden();
    await expect(page.getByTestId('preview-issue-badge')).toHaveText('0 issues');
    await expect(page.getByTestId('audit-issue-list').locator('li')).toHaveCount(0);
    await expect(page.getByTestId('audit-report')).toContainText('No issues found.');
  });
}

test('Try Demo AI Fix resolves all eight WCAG rule families in one pass', async ({ page }) => {
  await page.locator('#snippet-editor').fill(
    '<main style="background-color: #ffffff; padding: 16px;">' +
      '<h1 style="color: #111827;">Keyboard check</h1>' +
      '<h3 style="color: #111827;">Details</h3>' +
      '<img src="/logo.png" />' +
      '<a href="#" style="color: #1d4ed8;">Click here</a>' +
      '<button tabindex="3" class="outline-none" style="color: #111827; background-color: #ffffff;"></button>' +
      '<button style="color: #eeeeee; background-color: #ffffff;">Low contrast</button>' +
      '<input type="text" placeholder="Email" style="color: #111827; background-color: #ffffff;" />' +
      '</main>',
  );

  await expect(page.getByTestId('preview-issue-badge')).toHaveText('8 issues');
  for (const ruleId of [
    'color-contrast',
    'image-alt',
    'accessible-name',
    'form-label',
    'heading-order',
    'vague-link-text',
    'positive-tabindex',
    'focus-outline',
  ]) {
    expect(await ruleCount(page, ruleId), ruleId).toBe(1);
  }

  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByRole('button', { name: 'Try Demo AI Fix (No Key Required)' }).click();
  await expect(page.getByTestId('ai-fix-result')).toBeVisible();
  await page.getByTestId('apply-ai-fix-button').click();

  await expect(page.getByTestId('preview-issue-badge')).toHaveText('0 issues');
  await expect(page.getByTestId('audit-issue-list').locator('li')).toHaveCount(0);

  const patched = await page.locator('#snippet-editor').inputValue();
  expect(patched).toContain('alt="logo"');
  expect(patched).toContain('aria-label="Read about Details"');
  expect(patched).toContain('tabindex="0"');
  expect(patched).toContain('focus-visible:outline-2 focus-visible:outline-indigo-500');
  expect(patched).toContain('<h2 style="color: #111827;">Details</h2>');
  expect(patched).toContain('<label for="a11y-input-1" class="sr-only">Email</label>');
});

const OPENROUTER_COMPLETIONS = 'https://openrouter.ai/api/v1/chat/completions';

test('BYOK OpenRouter fix strips markdown fences, renders the diff and applies cleanly', async ({ page }) => {
  const requests: Array<{ url: string; authorization: string | null; body: Record<string, unknown> }> = [];
  const patchedHtml = [
    '<section style="background-color: #ffffff; padding: 16px;">',
    '  <img src="/hero.png" alt="Team collaborating in an office" />',
    '</section>',
  ].join('\n');

  await page.route('**/api/v1/chat/completions', async (route) => {
    const request = route.request();
    requests.push({
      url: request.url(),
      authorization: request.headers()['authorization'] ?? null,
      body: JSON.parse(request.postData() ?? '{}') as Record<string, unknown>,
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'chatcmpl-mocked',
        object: 'chat.completion',
        created: 0,
        model: 'openrouter/free',
        choices: [{
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            // Deliberately wrapped in fences with surrounding prose to prove sanitization.
            content: `Here is the accessible version:\n\n\`\`\`html\n${patchedHtml}\n\`\`\`\n\nLet me know if you need more changes!`,
          },
        }],
      }),
    });
  });

  await page.goto('/');
  await page.locator('#snippet-editor').fill([
    '<section style="background-color: #ffffff; padding: 16px;">',
    '  <img src="/hero.png" />',
    '</section>',
  ].join('\n'));
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('1 issue');

  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');
  await expect(page.getByTestId('openrouter-model-select')).toHaveValue('openrouter/free');
  await page.getByTestId('openrouter-key-input').fill('sk-or-dummy-key');
  await page.getByTestId('generate-ai-fix-button').click();

  const result = page.getByTestId('ai-fix-result');
  await expect(result).toBeVisible();
  await expect(result).toContainText('OpenRouter (openrouter/free)');

  expect(requests).toHaveLength(1);
  expect(requests[0]?.url).toBe(OPENROUTER_COMPLETIONS);
  expect(requests[0]?.authorization).toBe('Bearer sk-or-dummy-key');
  expect(requests[0]?.body.model).toBe('openrouter/free');

  const diff = page.getByTestId('ai-fix-diff');
  await expect(diff).toBeVisible();
  await expect(diff).toContainText('alt="Team collaborating in an office"');
  await expect(diff).not.toContainText('```');
  await expect(diff).not.toContainText('Here is the accessible version');

  await page.getByTestId('apply-ai-fix-button').click();
  await expect(page.getByTestId('ai-fix-drawer')).toBeHidden();
  await expect(page.locator('#snippet-editor')).toHaveValue(patchedHtml);
  await expect(page.getByTestId('preview-issue-badge')).toHaveText('0 issues');
});

test('OpenRouter free quick picks use a styled select with a clean custom-model fallback', async ({ page }) => {
  const requestedModels: string[] = [];
  await page.route('https://openrouter.ai/api/v1/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });
  await page.route(OPENROUTER_COMPLETIONS, async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { model?: string };
    requestedModels.push(body.model ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: '<main style="background-color: #ffffff; color: #111827;"><p>Accessible</p></main>',
          },
        }],
      }),
    });
  });

  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');

  // No datalist/input-list hack anywhere in the drawer.
  await expect(page.locator('[data-testid="ai-fix-drawer"] datalist')).toHaveCount(0);
  await expect(page.locator('[data-testid="ai-fix-drawer"] input[list]')).toHaveCount(0);

  const providerSelect = page.getByTestId('ai-provider-select');
  const modelSelect = page.getByTestId('openrouter-model-select');
  await expect(modelSelect).toHaveValue('openrouter/free');

  // One grouped section (live catalog) plus the custom option outside it.
  await expect(page.getByTestId('openrouter-model-hint')).toContainText('Smart-ranked $0 models');
  await expect(modelSelect.locator('optgroup')).toHaveCount(1);
  await expect(modelSelect.locator('optgroup')).toHaveAttribute('label', 'Free models (Live catalog)');
  await expect(modelSelect.locator('> option[value="__custom__"]')).toHaveCount(1);
  await expect(modelSelect.locator('optgroup option[value="__custom__"]')).toHaveCount(0);

  // Both dropdowns are real <select> elements with identical classes and chevron markup.
  expect(await providerSelect.evaluate((el) => el.tagName)).toBe('SELECT');
  expect(await modelSelect.evaluate((el) => el.tagName)).toBe('SELECT');
  const providerShape = await providerSelect.evaluate((el) => ({
    className: el.className,
    wrapperIcon: el.parentElement?.querySelector('svg')?.getAttribute('class'),
  }));
  const modelShape = await modelSelect.evaluate((el) => ({
    className: el.className,
    wrapperIcon: el.parentElement?.querySelector('svg')?.getAttribute('class'),
  }));
  expect(modelShape).toEqual(providerShape);
  expect(providerShape.className).toBe(
    'w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 pr-10 text-sm text-slate-100 focus:border-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-500',
  );

  const quickPicks = await modelSelect.locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value),
  );
  // Auto-router first, then coding affinity, then largest context window.
  expect(quickPicks.slice(0, 4)).toEqual([
    'openrouter/free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'liquid/lfm-3-1.7b:free',
  ]);
  expect(quickPicks.at(-1)).toBe('__custom__');
  expect(quickPicks).toContain('openrouter/free');

  // The custom text input only appears for the "Custom model ID..." option.
  const customInput = page.getByTestId('openrouter-custom-model-input');
  await expect(customInput).toHaveCount(0);
  await modelSelect.selectOption('__custom__');
  await expect(customInput).toBeVisible();

  await page.getByTestId('openrouter-key-input').fill('sk-or-dummy-key');
  await customInput.fill('custom/model:preview');
  await page.getByTestId('generate-ai-fix-button').click();

  await expect(page.getByTestId('ai-fix-result')).toContainText('OpenRouter (custom/model:preview)');
  expect(requestedModels).toEqual(['custom/model:preview']);
});

test('BYOK OpenRouter 429 response shows a friendly rate-limit error banner', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/chat/completions', async (route) => {
    calls += 1;
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      headers: { 'retry-after': '30' },
      body: JSON.stringify({ error: { message: 'Rate limit exceeded', type: 'rate_limit_exceeded' } }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');
  await page.getByTestId('openrouter-key-input').fill('sk-or-dummy-key');
  await page.getByTestId('generate-ai-fix-button').click();

  const error = page.getByTestId('ai-fix-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText('429');
  await expect(error).toContainText('rate limit');
  await expect(page.getByTestId('ai-fix-result')).toHaveCount(0);
  expect(calls).toBe(1);
});

test('BYOK OpenRouter 401 response explains how to fix an invalid key', async ({ page }) => {
  await page.route('**/api/v1/chat/completions', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Invalid API key', type: 'invalid_request_error' } }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');
  await page.getByTestId('openrouter-key-input').fill('sk-or-invalid-key');
  await page.getByTestId('generate-ai-fix-button').click();

  const error = page.getByTestId('ai-fix-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText('401');
  await expect(error).toContainText('rejected the API key');
});

test('Ollama connection failure labels fallback models as suggestions, not installed', async ({ page }) => {
  await page.route('**/api/tags', async (route) => {
    await route.abort('failed');
  });
  await page.route('**/api/generate', async (route) => {
    await route.abort('failed');
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('ollama');

  const modelSelect = page.getByTestId('ollama-model-select');
  await expect(modelSelect).toBeVisible();
  // Unreachable Ollama must never claim the curated quick picks are installed.
  await expect(page.getByTestId('ollama-model-source')).toHaveText('Suggested models (Ollama not connected)');
  await expect(modelSelect.locator('optgroup[label="Suggested models (Ollama not connected)"]')).toHaveCount(1);
  await expect(modelSelect.locator('optgroup[label="Installed local models (Detected)"]')).toHaveCount(0);
  await expect(page.getByTestId('ollama-status-pill')).toContainText(
    'Ollama not detected at localhost:11434 — start Ollama with OLLAMA_ORIGINS="*" or use Try Demo AI Fix.',
  );

  await page.getByTestId('generate-ai-fix-button').click();

  const error = page.getByTestId('ai-fix-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText('http://localhost:11434');
  await expect(error).toContainText('ollama pull qwen2.5-coder:7b');
  await expect(error).toContainText('Try Demo AI Fix');
});

test('Ollama auto-detects installed local models from /api/tags', async ({ page }) => {
  const tagRequests: string[] = [];
  await page.route('**/api/tags', async (route) => {
    tagRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        models: [{ name: 'llama3.2:latest' }, { name: 'qwen2.5-coder:7b' }],
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('ollama');

  const modelSelect = page.getByTestId('ollama-model-select');
  await expect(modelSelect).toBeVisible();
  await expect(modelSelect.locator('option[value="llama3.2:latest"]')).toHaveCount(1);
  await expect(modelSelect.locator('option[value="qwen2.5-coder:7b"]')).toHaveCount(1);
  await expect(modelSelect.locator('option[value="__ollama_custom__"]')).toHaveCount(1);
  await expect(page.getByTestId('ollama-model-source')).toHaveText('Installed local models (Detected)');
  await expect(modelSelect.locator('optgroup[label="Installed local models (Detected)"] option[value="llama3.2:latest"]')).toHaveCount(1);
  await expect(modelSelect.locator('optgroup[label="Suggested models (Ollama not connected)"]')).toHaveCount(0);
  await expect(page.getByTestId('ollama-status-pill')).toHaveCount(0);
  expect(tagRequests.length).toBeGreaterThan(0);
  expect(tagRequests[0]).toContain('/api/tags');
});

test('Ollama /api/tags with zero models shows suggestions, not installed models', async ({ page }) => {
  await page.route('**/api/tags', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ models: [] }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('ollama');

  const modelSelect = page.getByTestId('ollama-model-select');
  await expect(modelSelect).toBeVisible();
  await expect(page.getByTestId('ollama-model-source')).toHaveText('Suggested models (Ollama not connected)');
  await expect(modelSelect.locator('optgroup[label="Installed local models (Detected)"]')).toHaveCount(0);
  await expect(modelSelect.locator('optgroup[label="Suggested models (Ollama not connected)"]')).toHaveCount(1);
  await expect(page.getByTestId('ollama-status-pill')).toContainText('Ollama not detected at localhost:11434');
});

const ZERO_PRICE = { prompt: '0', completion: '0' };

test('smart OpenRouter discovery filters $0 models and ranks coding affinity then context', async ({ page }) => {
  await page.route('https://openrouter.ai/api/v1/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', context_length: 1_000_000, pricing: ZERO_PRICE },
          { id: 'inclusionai/Ling-2.0:free', name: 'Ling 2.0', context_length: 900_000, pricing: ZERO_PRICE },
          { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', context_length: 200_000, pricing: { prompt: '3', completion: '15' } },
          { id: 'openai/gpt-4o-mini:free', name: 'GPT-4o Mini', context_length: 128_000, pricing: { prompt: '0', completion: '0.0002' } },
          { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', context_length: 131_072, pricing: ZERO_PRICE },
          { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', context_length: 164_000, pricing: ZERO_PRICE },
          { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder', context_length: 262_144, pricing: ZERO_PRICE },
        ],
      }),
    });
  });

  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');

  const options = await page.getByTestId('openrouter-model-select').locator('option').evaluateAll((elements) =>
    elements.map((element) => {
      const option = element as HTMLOptionElement;
      return { value: option.value, label: option.textContent?.trim() ?? '' };
    }),
  );
  const values = options.map((option) => option.value);
  const labelFor = (id: string) => options.find((option) => option.value === id)?.label ?? '';

  expect(values[0]).toBe('openrouter/free');
  expect(labelFor('openrouter/free')).toContain('Free Models Auto-Router (Recommended)');
  // Congested and non-zero-cost models never enter the dropdown.
  for (const excluded of [
    'google/gemma-3-27b-it:free',
    'inclusionai/Ling-2.0:free',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o-mini:free',
  ]) {
    expect(values, excluded).not.toContain(excluded);
  }

  // Coding affinity outranks general models; larger context wins within a tier.
  expect(values.indexOf('qwen/qwen3-coder:free')).toBeLessThan(values.indexOf('deepseek/deepseek-r1:free'));
  expect(values.indexOf('deepseek/deepseek-r1:free')).toBeLessThan(
    values.indexOf('meta-llama/llama-3.3-70b-instruct:free'),
  );
  expect(values.indexOf('nvidia/nemotron-3.5-lightning:free')).toBeLessThan(
    values.indexOf('nvidia/nemotron-3-ultra-550b-a55b:free'),
  );

  // Clean, human-readable labels advertise the free tier and context window.
  expect(labelFor('qwen/qwen3-coder:free')).toBe('Qwen3 Coder (Free · 262K ctx)');
  expect(labelFor('deepseek/deepseek-r1:free')).toBe('DeepSeek R1 (Free · 164K ctx)');
  expect(labelFor('nvidia/nemotron-3.5-lightning:free')).toBe('Nemotron 3.5 Lightning (Free · 1M ctx)');
  expect(values.at(-1)).toBe('__custom__');
});

test('refresh button re-runs OpenRouter discovery and bypasses the catalog cache', async ({ page }) => {
  let catalogIds = ['qwen/qwen3-coder:free'];
  await page.route('https://openrouter.ai/api/v1/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: catalogIds.map((id) => ({ id, name: id, context_length: 65_536, pricing: ZERO_PRICE })),
      }),
    });
  });

  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');
  const modelSelect = page.getByTestId('openrouter-model-select');
  const refresh = page.getByRole('button', { name: 'Refresh OpenRouter models' });
  await expect(refresh).toBeVisible();
  await expect(modelSelect.locator('option[value="qwen/qwen3-coder:free"]')).toHaveCount(1);

  catalogIds = ['deepseek/deepseek-r1:free'];
  await refresh.click();

  await expect(modelSelect.locator('option[value="deepseek/deepseek-r1:free"]')).toHaveCount(1);
  await expect(modelSelect.locator('option[value="qwen/qwen3-coder:free"]')).toHaveCount(0);
  await expect(modelSelect).toHaveValue('openrouter/free');
});

test('a 404 on a free model is flagged in the dropdown and falls back to the auto-router', async ({ page }) => {
  await page.route('https://openrouter.ai/api/v1/models', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });
  const requestedModels: string[] = [];
  await page.route(OPENROUTER_COMPLETIONS, async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { model?: string };
    requestedModels.push(body.model ?? '');
    if (body.model === 'nvidia/nemotron-3.5-lightning:free') {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Model not found' } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: '<main><h1>Accessible title</h1></main>' } }] }),
    });
  });

  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');
  await page.getByTestId('openrouter-key-input').fill('sk-or-dummy-key');
  await page.getByTestId('openrouter-model-select').selectOption('nvidia/nemotron-3.5-lightning:free');
  await page.getByTestId('generate-ai-fix-button').click();

  await expect(page.getByTestId('ai-fix-result')).toBeVisible();
  expect(requestedModels).toEqual(['nvidia/nemotron-3.5-lightning:free', 'openrouter/free']);

  const options = await page.getByTestId('openrouter-model-select').locator('option').evaluateAll((elements) =>
    elements.map((element) => ({
      value: (element as HTMLOptionElement).value,
      label: element.textContent?.trim() ?? '',
    })),
  );
  expect(options.find((option) => option.value === 'nvidia/nemotron-3.5-lightning:free')?.label).toContain('(Rate-limited)');
  expect(options.find((option) => option.value === 'openrouter/free')?.label).not.toContain('(Rate-limited)');
});

test('a 429 on the pinned auto-router flags it and keeps the demo fallback available', async ({ page }) => {
  await page.route('https://openrouter.ai/api/v1/models', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });
  await page.route(OPENROUTER_COMPLETIONS, async (route) => {
    await route.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"rate limited"}' });
  });

  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('openrouter');
  await page.getByTestId('openrouter-key-input').fill('sk-or-dummy-key');
  await page.getByTestId('generate-ai-fix-button').click();

  await expect(page.getByTestId('ai-fix-error')).toContainText('429');
  const autoRouterLabel = await page
    .getByTestId('openrouter-model-select')
    .locator('option[value="openrouter/free"]')
    .textContent();
  expect(autoRouterLabel).toContain('(Rate-limited)');
  await expect(page.getByTestId('rate-limit-demo-fix-button')).toBeVisible();
});

test('refresh button re-runs Ollama local model discovery', async ({ page }) => {
  let installed = ['qwen2.5-coder:7b'];
  await page.route('**/api/tags', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ models: installed.map((name) => ({ name })) }),
    });
  });

  await page.getByRole('button', { name: 'AI Fix' }).click();
  await page.getByTestId('ai-provider-select').selectOption('ollama');
  const modelSelect = page.getByTestId('ollama-model-select');
  const refresh = page.getByRole('button', { name: 'Refresh Ollama models' });
  await expect(refresh).toBeVisible();
  await expect(modelSelect.locator('option[value="llama3.2:latest"]')).toHaveCount(0);

  installed = ['qwen2.5-coder:7b', 'llama3.2:latest'];
  await refresh.click();

  await expect(modelSelect.locator('option[value="llama3.2:latest"]')).toHaveCount(1);
  await expect(page.getByTestId('ollama-model-source')).toHaveText('Installed local models (Detected)');
  await expect(modelSelect.locator('optgroup[label="Installed local models (Detected)"] option[value="llama3.2:latest"]')).toHaveCount(1);
});
