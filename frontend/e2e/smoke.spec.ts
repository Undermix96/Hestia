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
  await expect(page.getByRole('main')).toBeVisible();
});

test('?scenario survives navigation', async ({ page }) => {
  await page.goto('/?scenario=perSlot');
  await expect(page).toHaveURL(/\/clima\/stanza\/soggiorno\?scenario=perSlot$/);
  const nav = page.getByRole('navigation', { name: it['nav.label'] });

  await nav.getByRole('link', { name: it['module.clima.tutte'], exact: true }).click();
  await expect(page).toHaveURL(/\/clima\/tutte\?scenario=perSlot$/);

  await nav.getByRole('link', { name: it['module.clima.stanza'], exact: true }).click();
  await expect(page).toHaveURL(/\/clima\/stanza\/[^?]+\?scenario=perSlot$/);
});

test('"apri la stanza" opens that room with ?scenario kept and the header in sync', async ({ page }) => {
  await page.goto('/clima/tutte?scenario=perSlot');
  const nav = page.getByRole('navigation', { name: it['nav.label'] });
  await expect(nav.getByRole('link', { name: it['module.clima.tutte'], exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByTestId('tutte-row-camera').getByRole('link').click();
  await expect(page).toHaveURL(/\/clima\/stanza\/camera\?scenario=perSlot$/);
  await expect(page.getByRole('main')).toBeVisible();
  const stanzaLink = nav.getByRole('link', { name: it['module.clima.stanza'], exact: true });
  await expect(stanzaLink).toHaveAttribute('aria-current', 'page');
  await expect(stanzaLink).toHaveAttribute('href', '/clima/stanza/camera?scenario=perSlot');
});

test('the range is shared by Stanza and Tutte', async ({ page }) => {
  await page.goto('/clima/tutte');
  const range = () => page.getByRole('group', { name: it['clima.range.label'] });
  await range().getByRole('button', { name: it['clima.range.7d'] }).click();
  await expect(range().getByRole('button', { name: it['clima.range.7d'] })).toHaveAttribute('aria-pressed', 'true');

  const nav = page.getByRole('navigation', { name: it['nav.label'] });
  await nav.getByRole('link', { name: it['module.clima.stanza'], exact: true }).click();
  await expect(page).toHaveURL(/\/clima\/stanza\/soggiorno$/);
  await expect(range().getByRole('button', { name: it['clima.range.7d'] })).toHaveAttribute('aria-pressed', 'true');
  await range().getByRole('button', { name: it['clima.range.24h'] }).click();

  await nav.getByRole('link', { name: it['module.clima.tutte'], exact: true }).click();
  await expect(range().getByRole('button', { name: it['clima.range.24h'] })).toHaveAttribute('aria-pressed', 'true');
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
    await expect(page.getByRole('main')).toBeVisible();
    await page.goto(`/clima/tutte?scenario=${scenario}`);
    await expect(page.getByRole('main')).toBeVisible();
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
