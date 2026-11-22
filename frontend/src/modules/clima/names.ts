/**
 * Display names of rooms, systems, levels, actions and modes.
 *
 * Entities carry either a free `name` (set by the user) or a `nameKey` (a
 * catalog message, e.g. the mock fixtures under `mock.*`); systems without
 * either fall back to their kind's name (`kind.<kind>.*`, then `kind.generic.*`).
 *
 * Like the kinds, a system's `nameKey` may have a short and a lowercase form for
 * running text (`<nameKey>.short`, `<nameKey>.lower`); without them the plain
 * message is used. A free `name` is always shown as the user typed it.
 */
import type { Action, Level, Mode } from '../../api/types';
import { hasMessage, t, tDynamic } from '../../i18n';

type Named = { name: string | null; nameKey: string | null };

/** The message of `key` if the catalog has it. */
function message(key: string | null): string | null {
  return key !== null && hasMessage(key) ? tDynamic(key, 'common.missingValue') : null;
}

function ownName(n: Named): string | null {
  return n.name ?? message(n.nameKey);
}

export function roomName(r: Named & { id?: string; roomId?: string }): string {
  return ownName(r) ?? r.id ?? r.roomId ?? t('common.missingValue');
}

export function systemName(s: Named & { kind: string }): string {
  return ownName(s) ?? tDynamic(`kind.${s.kind}.name`, 'kind.generic.name');
}

type NameForm = 'short' | 'lower';

function systemFormName(s: Named & { kind: string }, form: NameForm): string {
  if (s.name !== null) return s.name;
  const own = s.nameKey !== null ? (message(`${s.nameKey}.${form}`) ?? message(s.nameKey)) : null;
  return own ?? tDynamic(`kind.${s.kind}.${form}`, `kind.generic.${form}`);
}

/** Name in a status line ("caloriferi standby", "clima spento"). */
export function systemShortName(s: Named & { kind: string }): string {
  return systemFormName(s, 'short');
}

/** Name inside a sentence ("caloriferi + climatizzatore"). */
export function systemLowerName(s: Named & { kind: string }): string {
  return systemFormName(s, 'lower');
}

export function actionLabel(a: Action | null): string {
  return a === null ? t('action.unknown') : t(`action.${a}`);
}

export function modeLabel(m: Mode): string {
  return t(`mode.${m}`);
}

export function levelLabel(l: Level): string {
  return l.label ?? message(l.labelKey) ?? l.id;
}
