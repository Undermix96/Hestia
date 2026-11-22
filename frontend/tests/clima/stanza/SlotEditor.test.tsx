// Slot editor in the screen: option set per capabilities (D10), value and time steppers, Fatto, Ripristina, Esc.
import { act, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockDataSource } from '../../../src/api/datasource';
import { DataSourceError, type ScenarioId } from '../../../src/api/datasource/types';
import { resetClimaStore, useClimaStore } from '../../../src/modules/clima/store/climaStore';
import { catalog, editor, renderRoom, segmentButton, segmentButtons, thermogram } from './renderStanza';

const scopeLabels = () =>
  within(editor()!)
    .queryAllByRole('radio')
    .map((r) => r.textContent);
const editorValue = () => editor()!.querySelector('[class*="stepValue"]')!.textContent;
const plus = () => within(editor()!).getByRole('button', { name: catalog['clima.editor.increase'] });
const minus = () => within(editor()!).getByRole('button', { name: catalog['clima.editor.decrease'] });
const resetButton = () => within(editor()!).getByRole('button', { name: catalog['clima.editor.reset'] });
const doneButton = () => within(editor()!).getByRole('button', { name: catalog['clima.editor.done'] });

async function openEditor(button: HTMLButtonElement) {
  fireEvent.click(button);
  await waitFor(() => expect(editor()).not.toBeNull());
}

async function waitClosed() {
  await waitFor(() => expect(editor()).toBeNull(), { timeout: 3000 });
}

const SLOT = catalog['clima.editor.scope.slot'];
const VALUE = catalog['clima.editor.scope.permanentValue'];
const TIMES = catalog['clima.editor.scope.permanentTimes'];

describe('SlotEditor', () => {
  beforeEach(() => {
    resetClimaStore();
  });

  it('never renders past segments as buttons', async () => {
    for (const scenario of ['home', 'perSlot', 'manyRooms'] as ScenarioId[]) {
      resetClimaStore();
      const { view } = await renderRoom(scenario);
      const buttons = segmentButtons();
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.every((b) => b.dataset['state'] === 'current' || b.dataset['state'] === 'future')).toBe(true);
      view.unmount();
    }
  });

  it.each([
    // scenario, room, segment, options (D10: 'solo questa fascia' only on the current slot)
    ['home', 'soggiorno', 'z-soggiorno|fri|fri-1', [SLOT, VALUE, TIMES]],
    ['home', 'soggiorno', 'ac-soggiorno|fri|fri-0', [SLOT, VALUE, TIMES]],
    ['home', 'bagno', 'z-bagno|fri|fri-1', [SLOT, VALUE, TIMES]],
    ['home', 'bagno', 'z-bagno|fri|fri-2', [VALUE, TIMES]],
    ['perSlot', 'soggiorno', 'z-soggiorno|fri|fri-1', [SLOT, VALUE, TIMES]],
    ['manyRooms', 'soggiorno', 'deum-soggiorno|fri|fri-0', []],
  ] as [ScenarioId, string, string, string[]][])('%s %s %s offers %j', async (scenario, room, slot, options) => {
    await renderRoom(scenario, room);
    const [systemId, day, ref] = slot.split('|') as [string, string, string];
    await openEditor(segmentButton(systemId, day, ref));
    expect(scopeLabels()).toEqual(options);
    if (options.length > 1) {
      // the checked scope is focused on open
      expect(document.activeElement).toHaveAttribute('aria-checked', 'true');
    }
  });

  it('single permanentTimes option: no scope selector, only the times stepper', async () => {
    await renderRoom('manyRooms');
    await openEditor(segmentButton('deum-soggiorno', 'fri', 'fri-0'));
    expect(within(editor()!).queryByRole('radiogroup')).toBeNull();
    expect(within(editor()!).queryByRole('button', { name: catalog['clima.editor.increase'] })).toBeNull();
    expect(editor()).toHaveTextContent(catalog['clima.editor.note.permanentTimes']);
    const later = within(editor()!).getByRole('button', { name: 'Posticipa: Fine' });
    fireEvent.click(later);
    await waitFor(() => expect(useClimaStore.getState().draft?.change.to).toBe('12:30'));
    // dayScope 'all': the change applies to every day
    expect(useClimaStore.getState().draft?.change.days).toHaveLength(7);
    expect(within(editor()!).getByRole('group', { name: 'Fine' })).toHaveTextContent('12:30');
  });

  it('the levels warning names the level when the permanent value is chosen', async () => {
    await renderRoom('home');
    await openEditor(segmentButton('z-soggiorno', 'fri', 'fri-1'));
    expect(editor()).toHaveTextContent('vale solo per la fascia in corso, fino alle 23:00');
    fireEvent.click(within(editor()!).getByRole('radio', { name: VALUE }));
    expect(useClimaStore.getState().editorOption).toBe('permanentValue');
    expect(editor()).toHaveTextContent('cambia il livello «Comfort»: vale per tutte le fasce con questo livello');
    // arrow keys move the scope
    fireEvent.keyDown(within(editor()!).getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(useClimaStore.getState().editorOption).toBe('permanentTimes');
    expect(document.activeElement).toHaveTextContent(TIMES);
  });

  it('steps ±0.5 within ±4 of the program and previews the draft', async () => {
    await renderRoom('home');
    const button = segmentButton('z-soggiorno', 'fri', 'fri-1');
    await openEditor(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button.getAttribute('aria-controls')).toBe(editor()!.id);
    expect(editorValue()).toBe('21,0°');
    expect(resetButton()).toBeDisabled();

    fireEvent.click(plus());
    fireEvent.click(plus());
    expect(editorValue()).toBe('22,0°');
    expect(editor()).toHaveTextContent('programma 21,0° · modificato +1,0° da adesso in poi');
    expect(useClimaStore.getState().draft).toMatchObject({ scope: 'slot', change: { targetC: 22 } });
    expect(resetButton()).toBeEnabled();
    // the preview splits the current slot at now: the selected segment shows the draft value
    await waitFor(() =>
      expect(thermogram().querySelector('button[data-slot="z-soggiorno|fri|fri-1"]')).toHaveTextContent('22,0°'),
    );

    for (let i = 0; i < 10; i += 1) fireEvent.click(plus());
    expect(editorValue()).toBe('25,0°');
    expect(plus()).toBeDisabled();
    for (let i = 0; i < 20; i += 1) fireEvent.click(minus());
    expect(editorValue()).toBe('17,0°');
    expect(minus()).toBeDisabled();

    fireEvent.click(resetButton());
    expect(useClimaStore.getState().draft).toBeNull();
    expect(editorValue()).toBe('21,0°');
  });

  it('Fatto creates the override, closes the editor and marks the segment edited', async () => {
    const ds = new MockDataSource('home');
    const create = vi.spyOn(ds, 'createOverride');
    await renderRoom('home', 'soggiorno', ds);
    await openEditor(segmentButton('z-soggiorno', 'fri', 'fri-1'));
    fireEvent.click(plus());
    await act(async () => {
      fireEvent.click(doneButton());
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ systemId: 'z-soggiorno', slotRef: 'fri-1', day: 'fri', scope: 'slot' }),
    );
    await waitClosed();
    await waitFor(() => expect(segmentButton('z-soggiorno', 'fri', 'fri-1').className).toMatch(/edited/));
    expect(useClimaStore.getState().selection).toBeNull();
    // focus returns to the edited segment
    await waitFor(() => expect(document.activeElement).toBe(segmentButton('z-soggiorno', 'fri', 'fri-1')));

    // reopening shows the committed value; Ripristina deletes the override
    const remove = vi.spyOn(ds, 'deleteOverride');
    await openEditor(segmentButton('z-soggiorno', 'fri', 'fri-1'));
    expect(editorValue()).toBe('21,5°');
    expect(resetButton()).toBeEnabled();
    await act(async () => {
      fireEvent.click(resetButton());
    });
    expect(remove).toHaveBeenCalledWith('ovr-1');
    await waitFor(() => expect(editorValue()).toBe('21,0°'));
  });

  it('keeps the editor open with an alert when the save fails', async () => {
    const ds = new MockDataSource('home');
    vi.spyOn(ds, 'createOverride').mockRejectedValue(new DataSourceError('network', 'down'));
    await renderRoom('home', 'soggiorno', ds);
    await openEditor(segmentButton('z-soggiorno', 'fri', 'fri-1'));
    fireEvent.click(plus());
    await act(async () => {
      fireEvent.click(doneButton());
    });
    expect(await within(editor()!).findByRole('alert')).toHaveTextContent(catalog['clima.editor.error']);
    expect(editor()).not.toBeNull();
  });

  it('Esc closes the editor and gives the focus back to the segment', async () => {
    await renderRoom('home');
    const button = segmentButton('ac-soggiorno', 'fri', 'fri-0');
    await openEditor(button);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitClosed();
    expect(useClimaStore.getState().selection).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('clicking the selected segment again closes the editor', async () => {
    await renderRoom('home');
    const button = segmentButton('z-soggiorno', 'fri', 'fri-1');
    await openEditor(button);
    fireEvent.click(button);
    await waitClosed();
  });

  it('a future slot gets only the permanent options and edits the level value', async () => {
    await renderRoom('home', 'bagno');
    await openEditor(segmentButton('z-bagno', 'fri', 'fri-2'));
    expect(within(editor()!).getByRole('radio', { name: VALUE })).toHaveAttribute('aria-checked', 'true');
    expect(editor()).toHaveTextContent('Caloriferi · fascia 09:00–18:00');
    fireEvent.click(plus());
    expect(useClimaStore.getState().draft).toMatchObject({
      scope: 'permanentValue',
      change: { levelValueC: 20.5, targetC: null },
    });
  });
});
