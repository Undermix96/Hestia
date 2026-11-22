import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { chooseRange, expect, it, openStanza, openTutte, test, thermogram } from './fixtures';

// axe-core on the `home` screens, WCAG 2.0/2.1 A and AA rules. No rule is disabled.

/** Every room of `home` with a sensor (Ripostiglio has none: it has no Stanza page of its own). */
const HOME_ROOMS = ['soggiorno', 'corridoio', 'camera', 'cameretta', 'bagno'] as const;

async function expectNoViolations(page: Page): Promise<void> {
  // Let colour transitions (e.g. the range buttons after a click) end: axe would read a colour half way.
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter((a) => a.effect?.getComputedTiming().endTime !== Infinity);
    await Promise.all(finite.map((a) => a.finished.catch(() => undefined)));
  });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.map((n) => n.target.join(' ')),
  }));
  expect(summary).toEqual([]);
}

test.describe('accessibility (axe, WCAG 2.1 AA)', () => {
  test('Stanza 24 ore', async ({ page }) => {
    await openStanza(page);
    await expectNoViolations(page);
  });

  test('Stanza with the slot editor open', async ({ page }) => {
    await openStanza(page);
    await thermogram(page).locator('[data-system="z-soggiorno"] button[data-state="current"]').click();
    await expect(page.getByRole('group', { name: it['clima.editor.label'] })).toBeVisible();
    await expectNoViolations(page);
  });

  test('Stanza 7 giorni', async ({ page }) => {
    await openStanza(page);
    await chooseRange(page, '7d');
    await expectNoViolations(page);
  });

  // Every room: the program labels sit on fills that depend on the room's values (bagno has the 23° slots).
  for (const roomId of HOME_ROOMS.filter((r) => r !== 'soggiorno')) {
    test(`Stanza ${roomId}, 24 ore and 7 giorni`, async ({ page }) => {
      await openStanza(page, roomId);
      await expectNoViolations(page);
      await chooseRange(page, '7d');
      await expectNoViolations(page);
    });
  }

  test('Tutte le stanze 24 ore', async ({ page }) => {
    await openTutte(page);
    await expectNoViolations(page);
  });

  test('Tutte le stanze 7 giorni', async ({ page }) => {
    await openTutte(page);
    await chooseRange(page, '7d');
    await expectNoViolations(page);
  });
});
