import { expect, test, type Page } from '@playwright/test';
import it from '../../locales/it.json' with { type: 'json' };

// M1 runs on the mock data source: no backend and no /api calls are needed.

test('/ opens the first room and shows the app shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/clima\/stanza\/soggiorno$/);
  const nav = page.getByRole('navigation', { name: it['nav.label'] });
  await expect(nav.getByText(it['app.name'], { exact: true })).toBeVisible();

  const clima = nav.getByRole('group', { name: it['module.clima.name'] });
  await expect(clima.getByRole('link')).toHaveText([it['module.clima.stanza'], it['module.clima.tutte']]);
  await expect(clima.getByRole('link', { name: it['module.clima.stanza'] })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await expect(nav.getByRole('link', { name: it['module.energia.name'] })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: it['module.luci.name'] })).toHaveCount(0);
  // Attached, not visible: until the Stanza screen lands its only content is a visually hidden heading.
  await expect(page.getByRole('main')).toBeAttached();
});

test('?scenario survives navigation', async ({ page }) => {
  await page.goto('/?scenario=perSlot');
  await expect(page).toHaveURL(/\/clima\/stanza\/soggiorno\?scenario=perSlot$/);

  await page.getByRole('link', { name: it['module.clima.tutte'] }).click();
  await expect(page).toHaveURL(/\/clima\/tutte\?scenario=perSlot$/);

  await page.getByRole('link', { name: it['module.clima.stanza'] }).click();
  await expect(page).toHaveURL(/\/clima\/stanza\/[^?]+\?scenario=perSlot$/);
});

const SCENARIOS = ['home', 'perSlot', 'readonly', 'noProgram', 'manyRooms'] as const;

/** Fails the test on any console error or uncaught page error. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

for (const scenario of SCENARIOS) {
  test(`scenario ${scenario} boots both clima screens without errors`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`/clima/stanza?scenario=${scenario}`);
    await expect(page).toHaveURL((url) => url.pathname === '/clima/stanza/soggiorno' && url.search === `?scenario=${scenario}`);
    await expect(page.getByRole('main')).toBeAttached();
    await page.goto(`/clima/tutte?scenario=${scenario}`);
    await expect(page.getByRole('main')).toBeAttached();
    expect(errors).toEqual([]);
  });
}

test('an unknown scenario falls back to home with a warning', async ({ page }) => {
  const errors = collectErrors(page);
  const warnings: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  await page.goto('/?scenario=nope');
  await expect(page).toHaveURL(/\/clima\/stanza\/soggiorno\?scenario=nope$/);
  expect(warnings.some((w) => w.includes('Unknown scenario "nope"'))).toBe(true);
  expect(errors).toEqual([]);
});

test('?source=http without a data source shows the error view', async ({ page }) => {
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'no_data_source', message: 'No data source configured.' }),
    }),
  );
  await page.goto('/?source=http');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText(it['error.no_data_source']);
  await expect(alert.getByRole('button', { name: it['error.retry'] })).toBeVisible();
});
