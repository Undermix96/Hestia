// Capabilities → editor options (plan §2, spec §5.6, D10). The mock validation mirrors this matrix.
import type { ProgramRepresentation, ProgramSegment, SystemCapabilities } from '../../../api/types';
import type { EditorOption } from '../types';

export type NotEditableReason = 'past' | 'gap' | 'noProgram' | 'readonly';

export interface EditorAvailability {
  clickable: boolean;
  options: EditorOption[];
  defaultOption: EditorOption | null;
  /** changing a level value changes every slot using that level */
  levelsWarning: boolean;
  reason: NotEditableReason | null;
}

function notEditable(reason: NotEditableReason): EditorAvailability {
  return { clickable: false, options: [], defaultOption: null, levelsWarning: false, reason };
}

export function editorAvailability(
  seg: Pick<ProgramSegment, 'slotRef' | 'state'>,
  caps: SystemCapabilities,
  representation: ProgramRepresentation,
): EditorAvailability {
  if (representation === 'none' || !caps.program.read) return notEditable('noProgram');
  if (seg.slotRef == null) return notEditable('gap');
  if (seg.state === 'past') return notEditable('past');
  const options: EditorOption[] = [];
  // Temporary overrides only on the current slot (D10); future slots get permanent options only.
  if (caps.override.scopes.includes('slot') && seg.state === 'current' && representation !== 'onOff') options.push('slot');
  if (
    (representation === 'levels' && caps.program.writeLevelValues) ||
    (representation === 'perSlot' && caps.program.writeSlotValue)
  ) {
    options.push('permanentValue');
  }
  if (caps.program.writeTimes) options.push('permanentTimes');
  if (options.length === 0) return notEditable('readonly');
  return {
    clickable: true,
    options,
    defaultOption: options[0]!,
    levelsWarning: representation === 'levels' && options.includes('permanentValue'),
    reason: null,
  };
}
