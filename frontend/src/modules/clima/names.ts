/**
 * Display names of rooms, systems, levels, actions and modes.
 *
 * Entities carry either a free `name` (set by the user) or a `nameKey` (a
 * catalog message, e.g. the mock fixtures under `mock.*`); systems without
 * either fall back to their kind's name (`kind.<kind>.*`, then `kind.generic.*`).
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

export function systemShortName(s: Named & { kind: string }): string {
  return ownName(s) ?? tDynamic(`kind.${s.kind}.short`, 'kind.generic.short');
}

export function systemLowerName(s: Named & { kind: string }): string {
  return ownName(s) ?? tDynamic(`kind.${s.kind}.lower`, 'kind.generic.lower');
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
