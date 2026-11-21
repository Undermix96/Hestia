import { PALETTE } from '../logic/colors';
import type { SystemKindSpec } from './types';

/** Fallback for every kind without a dedicated spec (dehumidifier, vmc, ...). */
export const genericKind: SystemKindSpec = {
  kind: '*',
  messageKind: 'generic',
  dotShape: 'round',
  laneOrder: 50,
  programFill: (seg) => (seg.targetC != null || seg.on === true ? PALETTE.acProg : 'transparent'),
  weekBar: 'thin',
  showProgramValue: (seg) => seg.targetC != null,
};
