// Shared UI types of the clima module.
import type { SegmentState, Weekday } from '../../api/types';

export type EditorOption = 'slot' | 'permanentValue' | 'permanentTimes';

export interface SegmentSelection {
  systemId: string;
  segmentKey: string;
  slotRef: string;
  day: Weekday;
  state: Exclude<SegmentState, 'past'>;
}

export interface OutdoorNow {
  temperatureC: number | null;
  humidityPct: number | null;
}
