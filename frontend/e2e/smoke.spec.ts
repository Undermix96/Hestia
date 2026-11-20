import { expect, test } from '@playwright/test';
import it from '../src/i18n/it.json' with { type: 'json' };

test('shows the header and the backend version', async ({ page }) => {
  await page.route('**/api/version', (route) =>
    route.fulfill({ json: { version: '9.8.7', apiVersion: 1 } }),
  );

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(it['app.title']);
  const status = page.getByRole('status');
  await expect(status).toHaveAttribute('data-state', 'ok');
  await expect(status).toContainText('9.8.7');
});

test('shows an error state when the backend is unreachable', async ({ page }) => {
  await page.route('**/api/version', (route) => route.fulfill({ status: 502, body: '' }));

  await page.goto('/');

  const status = page.getByRole('status');
  await expect(status).toHaveAttribute('data-state', 'error');
  await expect(status).toHaveText(it['status.error']);
});
