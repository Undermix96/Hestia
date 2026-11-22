import type { Page } from '@playwright/test';
import {
  canCompareScreenshots,
  chooseRange,
  cursorSlider,
  expect,
  expectPageScreenshot,
  hoverSample,
  it,
  openTutte,
  test,
  tuttePanel,
  VISUAL_SKIP_REASON,
} from './fixtures';

// "Tutte le stanze" on the `home` scenario at the mock clock: docs/design/screenshots/tutte-*.png.

const values = (page: Page, roomId: string) => page.getByTestId(`tutte-values-${roomId}`).locator(':scope > *');
const readout = (page: Page) => page.getByTestId('tutte-readout');

test.describe('Tutte le stanze, scenario home', () => {
  test('24 ore: one row per room with the values at now', async ({ page }) => {
    await openTutte(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(it['clima.tutte.title']);
    await expect(readout(page)).toHaveText('adesso · 08:30');

    const panel = tuttePanel(page);
    await expect(panel.locator('[data-testid^="tutte-row-"]')).toHaveCount(6);
    await expect(panel.getByRole('img')).toHaveCount(5);
    await expect(
      panel.getByRole('img', { name: 'Soggiorno: 21,8°, target 21,0°, caloriferi standby e clima scalda' }),
    ).toBeVisible();

    await expect(values(page, 'soggiorno')).toHaveText(['21,8°', 'target 21,0°', 'caloriferi standby', 'clima scalda']);
    await expect(values(page, 'corridoio')).toHaveText(['19,2°', 'target 20,5°', 'clima scalda']);
    await expect(values(page, 'camera')).toHaveText(['18,1°', 'target 18,0°', 'caloriferi standby']);
    await expect(values(page, 'cameretta')).toHaveText(['19,8°', 'target 19,0°', 'caloriferi standby']);
    await expect(values(page, 'bagno')).toHaveText(['20,4°', 'target 23,0°', 'caloriferi scalda']);
    await expect(values(page, 'ripostiglio')).toHaveText(['—', 'nessun sensore']);
    await expect(page.getByTestId('tutte-outdoor-cursor')).toHaveText('5,9° · 83%');

    const ripostiglio = page.getByTestId('tutte-row-ripostiglio');
    await expect(ripostiglio).toContainText('caloriferi scalda (con Bagno)');
    await expect(page.getByTestId('tutte-chart-ripostiglio')).toContainText('Nessun sensore di temperatura · segue Bagno');

    await expect(panel.locator('[data-edge]')).toHaveText(['adesso', '12:00', '16:00', '20:00', '00:00', '04:00']);
  });

  test('7 giorni: day ticks and the 7-day values', async ({ page }) => {
    await openTutte(page);
    await chooseRange(page, '7d');
    await expect(values(page, 'soggiorno').first()).toHaveText('21,5°');
    const panel = tuttePanel(page);
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

  test('the cursor follows the pointer and the keyboard', async ({ page }) => {
    await openTutte(page);
    const slider = cursorSlider(tuttePanel(page));

    await hoverSample(page, slider, 50);
    await expect(readout(page)).toHaveText('previsione · 09:30');
    await expect(page.getByTestId('tutte-cursor-line')).toBeVisible();
    // The split of the soggiorno is off after 08:45.
    await expect(values(page, 'soggiorno').nth(3)).toHaveText('clima spento');

    await page.mouse.move(5, 5);
    await expect(readout(page)).toHaveText('adesso · 08:30');
    await expect(page.getByTestId('tutte-cursor-line')).toHaveCount(0);

    await slider.focus();
    await expect(slider).toHaveAttribute('aria-valuenow', '48');
    await page.keyboard.press('ArrowLeft');
    await expect(readout(page)).toHaveText('ore 08:00');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(readout(page)).toHaveText('previsione · 09:00');
    await page.keyboard.press('Escape');
    await expect(readout(page)).toHaveText('adesso · 08:30');
  });

  test('"apri la stanza" of Ripostiglio opens the room it follows', async ({ page }) => {
    await openTutte(page);
    await page.getByTestId('tutte-row-ripostiglio').getByRole('link', { name: 'Ripostiglio: apri la stanza Bagno' }).click();
    await expect(page).toHaveURL(/\/clima\/stanza\/bagno$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stanza · Bagno');
  });
});

test.describe('Tutte le stanze screenshots', { tag: '@visual' }, () => {
  test.skip(!canCompareScreenshots, VISUAL_SKIP_REASON);

  test('24 ore', async ({ page }) => {
    await openTutte(page);
    await expectPageScreenshot(page, 'tutte-24h.png');
  });

  test('7 giorni', async ({ page }) => {
    await openTutte(page);
    await chooseRange(page, '7d');
    await expect(values(page, 'soggiorno').first()).toHaveText('21,5°');
    await expectPageScreenshot(page, 'tutte-7d.png');
  });
});
