// Chart scales of the mockups (verbatim constants of NS.js / T.js). The SVG viewBox is 1000 wide.
import type { TimeRange } from '../../../api/types';

export const VIEW_W = 1000;
export const ROOM_H = 260;
export const OUT_H = 80;
export const MINI_H = 80;
export const TUTTE_OUT_H = 60;

/** Room chart, 14-25 °C */
export const yRoomT = (v: number) => 252 - ((v - 14) / 11) * 244;
/** Room chart, 30-80 % */
export const yRoomH = (v: number) => 252 - ((v - 30) / 50) * 244;
/** Outdoor chart (Stanza), 0-15 °C */
export const yOutT = (v: number) => 74 - (v / 15) * 68;
/** Outdoor chart (Stanza), 50-100 % */
export const yOutH = (v: number) => 76 - ((v - 50) / 50) * 72;
/** Tutte row chart, 15-24 °C */
export const yMiniT = (v: number) => 76 - ((v - 15) / 9) * 72;
export const yTutteOutT = (v: number) => 56 - (v / 15) * 50;
export const yTutteOutH = (v: number) => 58 - ((v - 50) / 50) * 54;

export const ROOM_TICKS = [24, 22, 20, 18, 16] as const;
/** Top of a room-chart tick label, in percent (render with toFixed(2)). */
export const tickTopPct = (v: number) => (yRoomT(v) / ROOM_H) * 100;

/** Centre of sample i (the mockup's X(i), as a number). */
export const xCenter = (i: number, n: number) => ((i + 0.5) / n) * VIEW_W;
/** Left edge of sample i. */
export const xEdge = (i: number, n: number) => (i / n) * VIEW_W;
/** Position of the "now" line in percent. */
/** Centre of sample i, in percent of the chart width. */
export const centerPct = (i: number, n: number) => ((i + 0.5) / n) * 100;
export const nowPct = (nowIndex: number, n: number) => centerPct(nowIndex, n);

/** A program segment shows its value when its width (percent) is larger than this. */
export const SEGMENT_LABEL_MIN_WIDTH_PCT: Record<TimeRange, number> = { '24h': 6, '7d': 2.2 };
/** The cursor tooltip flips to the left of the cursor past this fraction of the width. */
export const TOOLTIP_FLIP_AT = 0.6;
