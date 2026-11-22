import type { Locator, Page } from '@playwright/test';
import {
  canCompareScreenshots,
  chooseRange,
  cursorSlider,
  expect,
  expectPageScreenshot,
  fitViewportToPage,
  hoverSample,
  it,
  openStanza,
  test,
  thermogram,
  VISUAL_SKIP_REASON,
} from './fixtures';

// Stanza on the `home` scenario at the mock clock (Fri 20 Nov 2026, 08:30): docs/design/screenshots/stanza-*.png.

/** Sample under the cursor of docs/design/screenshots/stanza-cursore.png (24h: now is 48, so 09:30). */
const CURSOR_SAMPLE = 50;

const roomTabs = (page: Page) => page.getByRole('group', { name: it['clima.rooms.label'] });
const lane = (page: Page, systemId: string) => thermogram(page).locator(`[data-system="${systemId}"]`);
const editor = (page: Page) => page.getByRole('group', { name: it['clima.editor.label'] });
const tooltip = (page: Page) => page.getByTestId('cursor-tooltip');

async function expectTooltipAtSample50(tip: Locator): Promise<void> {
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('previsione · 09:30');
  await expect(tip).toContainText(/Stanza\s*21,3° · 49%/);
  await expect(tip).toContainText(/Caloriferi\s*target 21,0°/);
  await expect(tip).toContainText(/Climatizzatore\s*non programmato/);
  await expect(tip).toContainText(/azione\s*standby/);
  await expect(tip).toContainText(/azione\s*spento/);
  await expect(tip).toContainText(/Esterno\s*7,1° · 81%/);
}

test.describe('Stanza, scenario home', () => {
  test('24 ore: tabs, summary, legend, lanes and axis', async ({ page }) => {
    await openStanza(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stanza · Soggiorno');

    const tabs = roomTabs(page);
    await expect(tabs.getByRole('link')).toHaveCount(5);
    await expect(tabs.getByRole('link')).toContainText(['Soggiorno', 'Corridoio', 'Camera', 'Cameretta', 'Bagno']);
    await expect(tabs.getByRole('link', { name: /^Soggiorno/ })).toHaveAttribute('aria-current', 'page');
    await expect(tabs.getByRole('link', { name: /^Soggiorno/ })).toContainText('21,8°');
    await expect(tabs.getByRole('link', { name: /^Bagno/ })).toContainText('20,4°');
    const ripostiglio = tabs.locator('[data-room="ripostiglio"]');
    await expect(ripostiglio).toContainText('Ripostiglio');
    await expect(ripostiglio).toContainText('nessun sensore · segue Bagno');

    const summary = page.getByRole('region', { name: it['clima.stanza.summaryLabel'] });
    await expect(summary).toContainText(
      'Soggiorno è a 21,8°. I caloriferi sono fermi: la stanza è sopra il target di 21,0°. ' +
        'Il climatizzatore scalda verso 21,5°. Alle 08:45 il climatizzatore si spegne.',
    );
    await expect(summary).toContainText('Umidità 47% · fuori 5,9° e 83%.');

    const panel = thermogram(page);
    for (const key of [
      'clima.legend.measured',
      'clima.legend.forecast',
      'clima.legend.target',
      'clima.legend.comfort',
      'clima.legend.humidity',
    ] as const) {
      await expect(panel.getByText(it[key], { exact: true })).toBeVisible();
    }
    await expect(panel.getByText(it['clima.thermogram.hint'])).toBeVisible();
    await expect(panel.getByRole('img', { name: /^Termogramma di Soggiorno, ultime 24 ore/ })).toBeVisible();

    await expect(panel.locator('[data-system]')).toHaveCount(2);
    await expect(lane(page, 'z-soggiorno')).toBeVisible();
    await expect(lane(page, 'ac-soggiorno')).toBeVisible();
    await expect(panel.getByText('Caloriferi', { exact: true })).toBeVisible();
    await expect(panel.getByText('Climatizzatore', { exact: true })).toBeVisible();

    await expect(panel.locator('[data-edge]')).toHaveText(['adesso', '12:00', '16:00', '20:00', '00:00', '04:00']);

    const power = page.getByRole('region', { name: it['clima.power.label'] });
    await expect(power).toContainText('1,3');
    await expect(power).toContainText('8,8 kWh');
    await expect(power).toContainText('Novembre: 79 kWh · € 22,10 · i caloriferi non sono misurati');
    await expect(power).toContainText('Caldo');
    await expect(power.getByRole('button')).toHaveCount(0);

    await expect(page.getByTestId('clima-header-status')).toContainText('5,9° · 83%');
    await expect(page.getByRole('navigation', { name: it['nav.label'] })).toBeVisible();
    await expect(page.getByText('ven 20 nov · 08:30')).toBeVisible();
  });

  test('7 giorni: day ticks and the 7-day simulation', async ({ page }) => {
    await openStanza(page);
    await chooseRange(page, '7d');

    await expect(roomTabs(page).getByRole('link', { name: /^Soggiorno/ })).toContainText('21,5°');
    const panel = thermogram(page);
    await expect(panel.getByRole('img', { name: /^Termogramma di Soggiorno, ultimi 7 giorni/ })).toBeVisible();
    await expect(panel.locator('[data-edge]')).toHaveText([
      'adesso',
      'sab 14',
      'dom 15',
      'lun 16',
      'mar 17',
      'mer 18',
      'gio 19',
    ]);
  });

  test('cursor: hovering the chart shows the values of that sample', async ({ page }) => {
    await openStanza(page);
    const slider = cursorSlider(thermogram(page));

    await hoverSample(page, slider, CURSOR_SAMPLE);
    await expectTooltipAtSample50(tooltip(page));

    await page.mouse.move(5, 5);
    await expect(tooltip(page)).toHaveCount(0);
  });

  test('cursor: the keyboard starts at now and ←/→ move it', async ({ page }) => {
    await openStanza(page);
    const slider = cursorSlider(thermogram(page));

    await slider.focus();
    await expect(slider).toHaveAttribute('aria-valuenow', '48');
    await expect(tooltip(page)).toContainText('adesso · 08:30');

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuenow', String(CURSOR_SAMPLE));
    await expectTooltipAtSample50(tooltip(page));

    await page.keyboard.press('ArrowLeft');
    await expect(tooltip(page)).toContainText('previsione · 09:00');

    await page.keyboard.press('Escape');
    await expect(tooltip(page)).toHaveCount(0);
  });

  test('editor: opens on the current slot, edits it and closes with Esc', async ({ page }) => {
    await openStanza(page);
    const radiators = lane(page, 'z-soggiorno');
    const current = radiators.locator('button[data-state="current"]');
    await expect(current).toHaveCount(1);
    // Ended slots are not buttons: the first segment (from the left edge, in the past) is plain.
    await expect(radiators.locator('span[aria-hidden="true"][style*="left: 0%"]')).toHaveCount(1);
    await expect(radiators.locator('button[data-state="past"]')).toHaveCount(0);

    await current.click();
    const panel = editor(page);
    await expect(panel).toBeVisible();
    await expect(current).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toContainText(/Caloriferi · fascia \d\d:\d\d–\d\d:\d\d/);
    const scopes = panel.getByRole('radio');
    await expect(scopes).toHaveText([
      it['clima.editor.scope.slot'],
      it['clima.editor.scope.permanentValue'],
      it['clima.editor.scope.permanentTimes'],
    ]);
    await expect(scopes.first()).toHaveAttribute('aria-checked', 'true');
    await expect(scopes.first()).toBeFocused();
    await expect(panel).toContainText('21,0°');

    const increase = panel.getByRole('button', { name: it['clima.editor.increase'] });
    await increase.click();
    await increase.click();
    await expect(panel).toContainText('22,0°');
    await expect(panel).toContainText('programma 21,0° · modificato +1,0° da adesso in poi');

    await panel.getByRole('button', { name: it['clima.editor.done'] }).click();
    await expect(panel).toBeHidden();
    // The committed override splits the slot at now: the part from now on is the edited, current one.
    await expect(radiators.locator('button[data-state="current"]')).toHaveText('22,0°');

    await radiators.locator('button[data-state="current"]').click();
    await expect(editor(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(editor(page)).toBeHidden();
    await expect(radiators.locator('button[data-state="current"]')).toBeFocused();
  });

  test('editor: a future slot offers only the permanent options', async ({ page }) => {
    // The 24h forecast (2 h) holds no future slot; the 7-day one (12 h) has the split's afternoon slot.
    await openStanza(page);
    await chooseRange(page, '7d');
    await lane(page, 'ac-soggiorno').locator('button[data-state="future"]').first().click();
    const scopes = editor(page).getByRole('radio');
    await expect(scopes).toHaveText([it['clima.editor.scope.permanentValue'], it['clima.editor.scope.permanentTimes']]);
    await page.keyboard.press('Escape');
    await expect(editor(page)).toBeHidden();
  });
});

test.describe('Stanza screenshots', { tag: '@visual' }, () => {
  test.skip(!canCompareScreenshots, VISUAL_SKIP_REASON);

  test('24 ore', async ({ page }) => {
    await openStanza(page);
    await expectPageScreenshot(page, 'stanza-24h.png');
  });

  test('7 giorni', async ({ page }) => {
    await openStanza(page);
    await chooseRange(page, '7d');
    await expect(roomTabs(page).getByRole('link', { name: /^Soggiorno/ })).toContainText('21,5°');
    await expectPageScreenshot(page, 'stanza-7d.png');
  });

  test('cursore', async ({ page }) => {
    await openStanza(page);
    // Resize first: a later resize would move the chart under the mouse.
    await fitViewportToPage(page);
    await hoverSample(page, cursorSlider(thermogram(page)), CURSOR_SAMPLE);
    await expect(tooltip(page)).toContainText('previsione · 09:30');
    await expectPageScreenshot(page, 'stanza-cursor.png');
  });
});
