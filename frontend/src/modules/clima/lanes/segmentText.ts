// Texts and attributes of program segments, shared by the lanes and the slot editor.
import type { ProgramSegment } from '../../../api/types';
import { t } from '../../../i18n';
import { fmt } from '../../../i18n/format';
import { kindSpec } from '../systemKinds';

/** Text of a segment: its value or "acceso" (null: nothing to show). */
export function segmentValueText(seg: ProgramSegment, kind: string): string | null {
  if (kindSpec(kind).showProgramValue(seg) && seg.targetC != null) {
    return t('clima.segment.value', { value: fmt.temp(seg.targetC) });
  }
  if (seg.on === true) return t('clima.segment.on');
  if (seg.on === false) return t('action.off');
  return null;
}

/** Data attribute that finds the button of a slot occurrence again after its key changed. */
export function slotAttr(systemId: string, seg: Pick<ProgramSegment, 'day' | 'slotRef'>): string {
  return `${systemId}|${seg.day ?? ''}|${seg.slotRef ?? ''}`;
}
