import { expect, test } from '@playwright/test';

test('interactive elements use pointer cursors and disabled controls use not-allowed', async ({
  page,
}) => {
  await page.goto('/');

  const cursors = await page.evaluate(() => {
    const button = document.createElement('button');
    const disabledButton = document.createElement('button');
    disabledButton.disabled = true;
    const select = document.createElement('select');
    const link = document.createElement('a');
    link.href = '#cursor-probe';
    const roleButton = document.createElement('div');
    roleButton.setAttribute('role', 'button');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    const radio = document.createElement('input');
    radio.type = 'radio';
    const label = document.createElement('label');
    label.htmlFor = 'cursor-probe';

    document.body.append(button, disabledButton, select, link, roleButton, checkbox, radio, label);
    const result = {
      button: getComputedStyle(button).cursor,
      disabledButton: getComputedStyle(disabledButton).cursor,
      select: getComputedStyle(select).cursor,
      link: getComputedStyle(link).cursor,
      roleButton: getComputedStyle(roleButton).cursor,
      checkbox: getComputedStyle(checkbox).cursor,
      radio: getComputedStyle(radio).cursor,
      label: getComputedStyle(label).cursor,
    };
    [button, disabledButton, select, link, roleButton, checkbox, radio, label].forEach((element) =>
      element.remove(),
    );
    return result;
  });

  expect(cursors).toEqual({
    button: 'pointer',
    disabledButton: 'not-allowed',
    select: 'pointer',
    link: 'pointer',
    roleButton: 'pointer',
    checkbox: 'pointer',
    radio: 'pointer',
    label: 'pointer',
  });
});

test('Design Tokens tab replaces the HTML panes with live token insights', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('iframe[title="Snippet preview sandbox"]')).toBeVisible();
  await expect(page.getByTestId('audit-report')).toBeVisible();

  await page.getByRole('tab', { name: 'Design Tokens' }).click();

  await expect(page.getByTestId('token-insights-panel')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByTestId('audit-report')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Extracted Tokens' })).toHaveCount(0);
  await expect(page.getByText(/Preview not ready|token extraction skipped/)).toHaveCount(0);

  await page.getByTestId('token-json-editor').fill('{"color": {');
  await expect(page.getByTestId('token-validation')).toContainText('Invalid JSON');

  await page.getByRole('tab', { name: 'HTML Editor' }).click();
  await expect(page.locator('iframe[title="Snippet preview sandbox"]')).toBeVisible();
  await expect(page.getByTestId('audit-report')).toBeVisible();
  await expect(page.getByText(/Preview not ready|token extraction skipped/)).toHaveCount(0);
});
