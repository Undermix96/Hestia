import type { Page } from '@playwright/test';
import { expect, it, openStanza, openTutte, SCENARIOS, test, thermogram, tuttePanel } from './fixtures';

// Smoke tests of the mock scenarios (spec §8.3: only `home` is compared with the mockups).
// Every test fails on console errors (fixtures.ts).

const roomTabs = (page: Page) => page.getByRole('group', { name: it['clima.rooms.label'] });
const segmentButtons = (page: Page) => thermogram(page).locator('button[data-slot]');
const editor = (page: Page) => page.getByRole('group', { name: it['clima.editor.label'] });
const power = (page: Page) => page.getByRole('region', { name: it['clima.power.label'] });
const week = (page: Page) => page.getByRole('region', { name: it['clima.week.label'] });
const tutteRows = (page: Page) => tuttePanel(page).locator('[data-testid^="tutte-row-"]');

for (const scenario of SCENARIOS) {
  test(`${scenario}: both clima screens load`, async ({ page }) => {
    await page.goto(`/clima/stanza?scenario=${scenario}`);
    await expect(page).toHaveURL(
      (url) => url.pathname === '/clima/stanza/soggiorno' && url.search === `?scenario=${scenario}`,
    );
    await openStanza(page, 'soggiorno', scenario);
    await expect(page.getByRole('main')).toBeVisible();
    await openTutte(page, scenario);
    await expect(tutteRows(page).first()).toBeVisible();
  });
}

test('perSlot: per-slot values, weekend variant and the full editor', async ({ page }) => {
  await openStanza(page, 'soggiorno', 'perSlot');
  await expect(thermogram(page).getByText(it['clima.thermogram.hint'])).toBeVisible();

  // Weekdays start the day slot at 06:00 (left 25%), the weekend at 07:30 (left 31.25%).
  const row = (day: string) => week(page).getByRole('listitem').filter({ hasText: day });
  await expect(week(page).getByRole('listitem')).toHaveCount(7);
  await expect(row('Lun').locator('span[style*="left: 25%"]').first()).toBeAttached();
  await expect(row('Sab').locator('span[style*="left: 31.25%"]').first()).toBeAttached();
  await expect(row('Dom').locator('span[style*="left: 31.25%"]').first()).toBeAttached();
  await expect(row('Sab').locator('span[style*="left: 25%"]')).toHaveCount(0);

  await expect(thermogram(page).locator('button[data-slot][data-state="past"]')).toHaveCount(0);
  await thermogram(page).locator('[data-system="z-soggiorno"] button[data-state="current"]').click();
  await expect(editor(page).getByRole('radio')).toHaveText([
    it['clima.editor.scope.slot'],
    it['clima.editor.scope.permanentValue'],
    it['clima.editor.scope.permanentTimes'],
  ]);
  await page.keyboard.press('Escape');
  await expect(editor(page)).toBeHidden();
});

test('readonly: no editable slot, read-only hint', async ({ page }) => {
  await openStanza(page, 'soggiorno', 'readonly');
  await expect(segmentButtons(page)).toHaveCount(0);
  await expect(thermogram(page).locator('[data-system]')).toHaveCount(2);
  await expect(thermogram(page).getByText(it['clima.thermogram.hintReadonly'])).toBeVisible();
  await expect(thermogram(page).getByText(it['clima.thermogram.hint'])).toHaveCount(0);

  // The program is still shown, in every room.
  await expect(week(page).getByRole('listitem')).toHaveCount(7);
  await roomTabs(page).getByRole('link', { name: /^Bagno/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stanza · Bagno');
  await expect(segmentButtons(page)).toHaveCount(0);
});

test('noProgram: lanes without program bars, mode as text', async ({ page }) => {
  await openStanza(page, 'soggiorno', 'noProgram');
  const panel = thermogram(page);
  await expect(panel.getByText(it['clima.lane.noProgram'], { exact: true })).toHaveCount(2);
  await expect(segmentButtons(page)).toHaveCount(0);
  // The program bar of each lane holds only the "nessun programma" text, no segment.
  await expect(panel.locator('[data-system] > :first-child > *')).toHaveText([
    it['clima.lane.noProgram'],
    it['clima.lane.noProgram'],
  ]);
  await expect(panel.getByText(it['clima.thermogram.hint'])).toHaveCount(0);
  await expect(panel.getByText(it['clima.thermogram.hintReadonly'])).toHaveCount(0);

  await expect(power(page)).toContainText('Spento');
  await expect(power(page).getByRole('button')).toHaveCount(0);
  await expect(week(page)).toContainText('Caloriferi: nessun programma');
  await expect(week(page)).toContainText('Climatizzatore: nessun programma');
  await expect(week(page).getByRole('listitem')).toHaveCount(0);

  await openTutte(page, 'noProgram');
  await expect(tutteRows(page)).toHaveCount(6);
});

test('manyRooms: 10 rooms, three lanes with the generic dehumidifier', async ({ page }) => {
  await openStanza(page, 'soggiorno', 'manyRooms');
  await expect(roomTabs(page).getByRole('link')).toHaveCount(8);
  await expect(roomTabs(page).locator('[data-room]')).toHaveCount(2);
  await expect(roomTabs(page).locator('[data-room="lavanderia"]')).toContainText('nessun sensore · segue Bagno di servizio');

  const panel = thermogram(page);
  await expect(panel.locator('[data-system]')).toHaveCount(3);
  await expect(panel.getByText('Deumidificatore', { exact: true })).toBeVisible();
  await expect(panel.getByText(it['clima.legend.dry'], { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: it['clima.stanza.summaryLabel'] })).toContainText(
    'Deumidificatore: nessuna fascia attiva adesso.',
  );
  await expect(power(page)).toContainText('i caloriferi non sono misurati · Deumidificatore: non misurato');

  await openTutte(page, 'manyRooms');
  await expect(tutteRows(page)).toHaveCount(10);
  await expect(tuttePanel(page).getByRole('img')).toHaveCount(8);
  await expect(page.getByTestId('tutte-row-soggiorno')).toContainText('deumidificatore spento');
  await expect(page.getByTestId('tutte-chart-soggiorno').getByTestId('tutte-strip')).toHaveCount(3);
});
