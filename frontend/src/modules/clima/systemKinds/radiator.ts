import { radiatorColor } from '../logic/colors';
import type { SystemKindSpec } from './types';

export const radiatorKind: SystemKindSpec = {
  kind: 'radiator',
  messageKind: 'radiator',
  dotShape: 'square',
  laneOrder: 0,
  programFill: (seg) => (seg.targetC != null ? radiatorColor(seg.targetC) : 'transparent'),
  weekBar: 'full',
  showProgramValue: (seg) => seg.targetC != null,
};
