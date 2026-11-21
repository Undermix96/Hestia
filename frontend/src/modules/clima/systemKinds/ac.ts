import { PALETTE } from '../logic/colors';
import type { SystemKindSpec } from './types';

export const acKind: SystemKindSpec = {
  kind: 'ac',
  messageKind: 'ac',
  dotShape: 'round',
  laneOrder: 10,
  programFill: (seg) => (seg.targetC != null || seg.on === true ? PALETTE.acProg : 'transparent'),
  weekBar: 'thin',
  showProgramValue: (seg) => seg.targetC != null,
};
