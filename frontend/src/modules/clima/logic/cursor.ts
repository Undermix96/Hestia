// Cursor of the charts: pointer → sample, keyboard steps, phase (pure).
import type { TimeRange } from '../../../api/types';
import { TOOLTIP_FLIP_AT } from '../thermogram/scales';

export function indexFromPointer(clientX: number, rect: { left: number; width: number }, n: number): number {
  if (rect.width <= 0) return 0;
  return Math.max(0, Math.min(n - 1, Math.floor(((clientX - rect.left) / rect.width) * n)));
}

export type CursorPhase = 'past' | 'now' | 'forecast';

export function cursorPhase(index: number, nowIndex: number): CursorPhase {
  if (index < nowIndex) return 'past';
  return index === nowIndex ? 'now' : 'forecast';
}

/** The tooltip goes to the left of the cursor in the right part of the chart. */
export function tooltipOnLeft(index: number, n: number): boolean {
  return (index + 0.5) / n > TOOLTIP_FLIP_AT;
}

const STEPS: Record<TimeRange, { shift: number; page: number }> = {
  '24h': { shift: 2, page: 8 },
  '7d': { shift: 12, page: 48 },
};

/** ArrowLeft/Right ±1 (Shift: 1 h in 24h, 6 h in 7d), PageUp/PageDown ∓/± 4 h / 1 day, Home/End. */
export function keyboardStep(key: string, range: TimeRange, shift: boolean): number | 'home' | 'end' | null {
  const s = STEPS[range];
  switch (key) {
    case 'ArrowLeft':
      return shift ? -s.shift : -1;
    case 'ArrowRight':
      return shift ? s.shift : 1;
    case 'PageUp':
      return -s.page;
    case 'PageDown':
      return s.page;
    case 'Home':
      return 'home';
    case 'End':
      return 'end';
    default:
      return null;
  }
}

/** Applies a step; a null cursor starts at nowIndex. */
export function moveCursor(current: number | null, step: number | 'home' | 'end', nowIndex: number, n: number): number {
  if (step === 'home') return 0;
  if (step === 'end') return n - 1;
  return Math.max(0, Math.min(n - 1, (current ?? nowIndex) + step));
}
