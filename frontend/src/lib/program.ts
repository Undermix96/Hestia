// Program helpers shared by the mock data source and the slot editor.
import type { Slot } from '../api/types';

/** Slots contiguous from 00:00 to 24:00 (a full-coverage day: every minute belongs to a slot). */
export function isFullCoverage(day: readonly Pick<Slot, 'from' | 'to'>[]): boolean {
  if (day.length === 0) return false;
  if (day[0]!.from !== '00:00' || day[day.length - 1]!.to !== '24:00') return false;
  for (let i = 1; i < day.length; i += 1) if (day[i - 1]!.to !== day[i]!.from) return false;
  return true;
}
