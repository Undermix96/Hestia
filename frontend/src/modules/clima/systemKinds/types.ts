// Presentation spec of a system kind (radiator, ac, generic fallback). i18n-free: `messageKind` is the suffix
// of the kind.* and clima.summary.* message keys.
export type MessageKind = 'radiator' | 'ac' | 'generic';

export interface SystemKindSpec {
  /** 'radiator' | 'ac' | '*' (generic fallback) */
  kind: string;
  messageKind: MessageKind;
  /** square = border-radius 2px, round = 50% */
  dotShape: 'square' | 'round';
  /** client lane sort (stable): radiator 0, ac 10, generic 50 */
  laneOrder: number;
  /** CSS background of a program segment */
  programFill(seg: { targetC: number | null; on: boolean | null }): string;
  /** week program: 18px coloured bar with values, or 8px bar */
  weekBar: 'full' | 'thin';
  /** whether a program segment shows its value */
  showProgramValue(seg: { targetC: number | null; on: boolean | null }): boolean;
}
