import { test as base, expect, type Locator, type Page } from '@playwright/test';
import it from '../../locales/it.json' with { type: 'json' };

/**
 * Shared Playwright fixtures for every e2e spec.
 *
 * - `Date` is frozen at the mock clock (spec D1), so anything Date-based is deterministic even if a component
 *   reads the browser clock instead of the data source's.
 * - `prefers-reduced-motion: reduce` is emulated: the entrance cascade, line reveals and pulses are off, so
 *   screenshots never catch an animation half way.
 * - Any `console.error` or uncaught page error fails the test (after its body has run). A spec that expects
 *   one (e.g. a mocked 503 logged by the browser) lists it with `test.use({ allowedConsoleErrors: [/.../] })`.
 */

/** The fixed clock of the mock data source: 20 Nov 2026, 08:30, Europe/Rome. */
export const MOCK_NOW = new Date('2026-11-20T08:30:00+01:00');

export const SCENARIOS = ['home', 'perSlot', 'readonly', 'noProgram', 'manyRooms'] as const;
export type Scenario = (typeof SCENARIOS)[number];

/** Visual baselines are Linux renders (spec D12): screenshot tests are skipped on other hosts. */
export const VISUAL_SKIP_REASON = 'screenshot baselines are Linux renders (see frontend/README.md)';
export const canCompareScreenshots = process.platform === 'linux';

interface Fixtures {
  /** Console errors matching one of these patterns do not fail the test. */
  allowedConsoleErrors: RegExp[];
}

export const test = base.extend<Fixtures>({
  allowedConsoleErrors: [[], { option: true }],
  // `run` is Playwright's fixture callback (named `use` in its docs, which the React hooks lint rule mistakes for a hook).
  page: async ({ page, allowedConsoleErrors }, run) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (!allowedConsoleErrors.some((re) => re.test(text))) errors.push(`console.error: ${text}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    await page.clock.setFixedTime(MOCK_NOW);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await run(page);

    expect(errors, 'the page logged errors').toEqual([]);
  },
});

export { expect, it };

/** URL with the scenario query (none for `home`, the default). */
export function withScenario(path: string, scenario: Scenario = 'home'): string {
  return scenario === 'home' ? path : `${path}?scenario=${scenario}`;
}

export const nav = (page: Page): Locator => page.getByRole('navigation', { name: it['nav.label'] });
export const rangeGroup = (page: Page): Locator => page.getByRole('group', { name: it['clima.range.label'] });
export const thermogram = (page: Page): Locator => page.getByRole('region', { name: it['clima.thermogram.label'] });
export const tuttePanel = (page: Page): Locator => page.getByRole('region', { name: it['clima.tutte.label'] });
export const cursorSlider = (scope: Locator): Locator => scope.getByRole('slider', { name: it['clima.cursor.slider'] });

/** Waits until the self-hosted fonts are loaded and the header shows the outdoor reading. */
async function settle(page: Page): Promise<void> {
  await expect(page.getByTestId('clima-header-status')).not.toBeEmpty();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/** Opens a Stanza page and waits for its real content (not the loading skeleton). */
export async function openStanza(page: Page, roomId = 'soggiorno', scenario: Scenario = 'home'): Promise<void> {
  await page.goto(withScenario(`/clima/stanza/${roomId}`, scenario));
  await expect(thermogram(page)).toBeVisible();
  await expect(page.getByRole('region', { name: it['clima.power.label'] })).toBeVisible();
  await expect(page.getByRole('region', { name: it['clima.week.label'] })).toBeVisible();
  await settle(page);
}

/** Opens "Tutte le stanze" and waits for the panel with its rows. */
export async function openTutte(page: Page, scenario: Scenario = 'home'): Promise<void> {
  await page.goto(withScenario('/clima/tutte', scenario));
  await expect(tuttePanel(page)).toBeVisible();
  await expect(page.getByTestId('tutte-readout')).not.toBeEmpty();
  await settle(page);
}

/** Switches the shared range and waits for the selector to show it. */
export async function chooseRange(page: Page, range: '24h' | '7d'): Promise<void> {
  const button = rangeGroup(page).getByRole('button', { name: it[`clima.range.${range}`] });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

/**
 * Moves the mouse over the centre of sample `index` of a chart whose cursor layer is `slider`
 * (the slider spans the plot's full width, like the pointer area).
 */
export async function hoverSample(page: Page, slider: Locator, index: number): Promise<void> {
  const box = await slider.boundingBox();
  if (!box) throw new Error('cursor slider not visible');
  const count = Number(await slider.getAttribute('aria-valuemax')) + 1;
  await page.mouse.move(box.x + ((index + 0.5) / count) * box.width, box.y + box.height / 2);
}

/**
 * Grows the viewport (width unchanged) to the page's full height, so a screenshot of the viewport is the whole
 * page. A `fullPage` capture would resize the page while it shoots, which drops the hover state of the cursor.
 */
export async function fitViewportToPage(page: Page): Promise<void> {
  const size = page.viewportSize();
  if (!size) throw new Error('no viewport');
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  if (height !== size.height) await page.setViewportSize({ width: size.width, height });
}

/** Whole-page screenshot compared with the Linux baseline `name`. */
export async function expectPageScreenshot(page: Page, name: string): Promise<void> {
  await settle(page);
  await fitViewportToPage(page);
  await expect(page).toHaveScreenshot(name);
}
