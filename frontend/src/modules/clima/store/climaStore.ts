/**
 * UI state of the clima module, shared by Stanza, Tutte and the header.
 * The room id lives in the URL (`/clima/stanza/:roomId`), not here.
 */
import { create } from 'zustand';
import type { OverrideCreate, TimeRange } from '../../../api/types';
import type { EditorOption, OutdoorNow, SegmentSelection } from '../types';

export interface ClimaState {
  /** Default '24h'; shared by Stanza and Tutte. */
  range: TimeRange;
  /** Last room shown in Stanza (header link). */
  lastRoomId: string | null;
  /** Hovered/keyboard sample; null = none (readouts show nowIndex). */
  cursorIndex: number | null;
  /** Segment whose editor is open. */
  selection: SegmentSelection | null;
  editorOption: EditorOption | null;
  draft: OverrideCreate | null;
  /** Outdoor conditions now, for the header status. */
  outdoorNow: OutdoorNow | null;
  /** Also clears the cursor and closes the editor. */
  setRange(range: TimeRange): void;
  /** When the room changes: clears the cursor and closes the editor. */
  setLastRoom(roomId: string): void;
  setCursor(index: number | null): void;
  /** Opens (or, with null, closes) the editor; the draft is discarded. */
  select(selection: SegmentSelection | null, option: EditorOption | null): void;
  /** The draft is discarded. */
  setEditorOption(option: EditorOption): void;
  setDraft(draft: OverrideCreate | null): void;
  /** selection, editorOption and draft back to null. */
  closeEditor(): void;
  setOutdoorNow(value: OutdoorNow | null): void;
}

type ClimaData = Pick<
  ClimaState,
  'range' | 'lastRoomId' | 'cursorIndex' | 'selection' | 'editorOption' | 'draft' | 'outdoorNow'
>;

const CLOSED_EDITOR = { selection: null, editorOption: null, draft: null } as const;

function initialData(): ClimaData {
  return {
    range: '24h',
    lastRoomId: null,
    cursorIndex: null,
    ...CLOSED_EDITOR,
    outdoorNow: null,
  };
}

function sameOutdoor(a: OutdoorNow | null, b: OutdoorNow | null): boolean {
  if (a === null || b === null) return a === b;
  return a.temperatureC === b.temperatureC && a.humidityPct === b.humidityPct;
}

export const useClimaStore = create<ClimaState>()((set, get) => ({
  ...initialData(),
  setRange(range) {
    set({ range, cursorIndex: null, ...CLOSED_EDITOR });
  },
  setLastRoom(roomId) {
    if (get().lastRoomId === roomId) return;
    set({ lastRoomId: roomId, cursorIndex: null, ...CLOSED_EDITOR });
  },
  setCursor(index) {
    if (get().cursorIndex === index) return;
    set({ cursorIndex: index });
  },
  select(selection, option) {
    set(
      selection === null
        ? { ...CLOSED_EDITOR }
        : { selection, editorOption: option, draft: null },
    );
  },
  setEditorOption(option) {
    set({ editorOption: option, draft: null });
  },
  setDraft(draft) {
    set({ draft });
  },
  closeEditor() {
    set({ ...CLOSED_EDITOR });
  },
  setOutdoorNow(value) {
    if (sameOutdoor(get().outdoorNow, value)) return;
    set({ outdoorNow: value });
  },
}));

/** Restores the initial state (tests). */
export function resetClimaStore(): void {
  useClimaStore.setState(initialData());
}
