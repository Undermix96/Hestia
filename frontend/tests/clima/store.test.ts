import { beforeEach, describe, expect, it } from 'vitest';
import type { OverrideCreate } from '../../src/api/types';
import { resetClimaStore, useClimaStore } from '../../src/modules/clima/store/climaStore';
import type { SegmentSelection } from '../../src/modules/clima/types';

const selection: SegmentSelection = {
  systemId: 'rad-soggiorno',
  segmentKey: 'rad-soggiorno|fri|0',
  slotRef: 'fri:0',
  day: 'fri',
  state: 'current',
};

const draft: OverrideCreate = {
  systemId: 'rad-soggiorno',
  scope: 'slot',
  day: 'fri',
  slotRef: 'fri:0',
  validUntil: null,
  change: { deltaC: null, targetC: 21.5, levelValueC: null, from: null, to: null, days: null },
};

const state = () => useClimaStore.getState();

/** Opens the editor with a draft and a cursor. */
function openEditorWithDraft() {
  state().setCursor(12);
  state().select(selection, 'slot');
  state().setDraft(draft);
}

describe('climaStore', () => {
  beforeEach(() => {
    resetClimaStore();
  });

  it('starts with the defaults', () => {
    expect(state()).toMatchObject({
      range: '24h',
      lastRoomId: null,
      cursorIndex: null,
      selection: null,
      editorOption: null,
      draft: null,
      outdoorNow: null,
    });
  });

  it('setRange clears the cursor and closes the editor', () => {
    openEditorWithDraft();
    state().setRange('7d');
    expect(state()).toMatchObject({
      range: '7d',
      cursorIndex: null,
      selection: null,
      editorOption: null,
      draft: null,
    });
  });

  it('setLastRoom clears cursor and editor only when the room changes', () => {
    state().setLastRoom('soggiorno');
    openEditorWithDraft();

    state().setLastRoom('soggiorno');
    expect(state().selection).toEqual(selection);
    expect(state().cursorIndex).toBe(12);

    state().setLastRoom('camera');
    expect(state()).toMatchObject({ lastRoomId: 'camera', cursorIndex: null, selection: null, draft: null });
  });

  it('setCursor', () => {
    state().setCursor(5);
    expect(state().cursorIndex).toBe(5);
    state().setCursor(null);
    expect(state().cursorIndex).toBeNull();
  });

  it('select opens the editor and discards the draft', () => {
    openEditorWithDraft();
    expect(state().draft).toEqual(draft);

    const other = { ...selection, segmentKey: 'rad-soggiorno|fri|1', slotRef: 'fri:1', state: 'future' as const };
    state().select(other, 'permanentValue');
    expect(state()).toMatchObject({ selection: other, editorOption: 'permanentValue', draft: null });
  });

  it('select(null) closes the editor', () => {
    openEditorWithDraft();
    state().select(null, null);
    expect(state()).toMatchObject({ selection: null, editorOption: null, draft: null });
  });

  it('setEditorOption discards the draft', () => {
    openEditorWithDraft();
    state().setEditorOption('permanentTimes');
    expect(state()).toMatchObject({ selection, editorOption: 'permanentTimes', draft: null });
  });

  it('closeEditor keeps range, room and cursor', () => {
    state().setRange('7d');
    state().setLastRoom('bagno');
    openEditorWithDraft();
    state().closeEditor();
    expect(state()).toMatchObject({
      range: '7d',
      lastRoomId: 'bagno',
      cursorIndex: 12,
      selection: null,
      editorOption: null,
      draft: null,
    });
  });

  it('setOutdoorNow does not notify for an equal value', () => {
    let notifications = 0;
    const unsubscribe = useClimaStore.subscribe(() => {
      notifications += 1;
    });
    state().setOutdoorNow({ temperatureC: 5.9, humidityPct: 83 });
    state().setOutdoorNow({ temperatureC: 5.9, humidityPct: 83 });
    expect(notifications).toBe(1);
    expect(state().outdoorNow).toEqual({ temperatureC: 5.9, humidityPct: 83 });
    state().setOutdoorNow(null);
    expect(state().outdoorNow).toBeNull();
    unsubscribe();
  });

  it('resetClimaStore restores the defaults', () => {
    state().setRange('7d');
    state().setLastRoom('camera');
    resetClimaStore();
    expect(state()).toMatchObject({ range: '24h', lastRoomId: null });
  });
});
