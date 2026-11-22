// Turns the summary facts of a room (logic/summaryFacts.ts) into the sentences of the Stanza summary.
// Per-kind messages fall back to their `.generic` variant when a kind has no dedicated text.
import { t, tDynamic } from '../../../../i18n';
import { fmt } from '../../../../i18n/format';
import type { NextChangeFact, SummaryFacts, SystemFact } from '../../logic/summaryFacts';

export interface SummaryText {
  /** "Soggiorno è a 21,8°." (bold) */
  lead: string;
  /** system sentences and the next program change, separated by a space */
  rest: string;
  /** "Umidità 47% · fuori 5,9° e 83%." */
  conditions: string;
  /** lead + rest */
  full: string;
}

function temp(v: number | null): string {
  return v == null ? t('common.missingValue') : fmt.temp(v);
}

function pct(v: number | null): string {
  return v == null ? t('common.missingValue') : fmt.pct(v);
}

/** Every value a system message may use (ICU throws on a missing argument). */
function systemSentence(fact: SystemFact): string {
  const s = fact.state;
  const targetC = 'targetC' in s ? s.targetC : null;
  const values = {
    system: fact.displayName,
    target: temp(targetC),
    hasTarget: String(targetC != null),
    overshoot: String(s.type === 'heatingTowards' && s.overshoot),
    temperature: temp(s.type === 'inRange' ? s.temperatureC : null),
    low: temp(s.type === 'inRange' ? s.lowC : null),
    high: temp(s.type === 'inRange' ? s.highC : null),
  };
  return tDynamic(
    `clima.summary.system.${s.type}.${fact.messageKind}`,
    `clima.summary.system.${s.type}.generic`,
    values,
  );
}

function nextSentence(next: NextChangeFact, timeZone: string): string {
  return tDynamic(
    `clima.summary.next.${next.change}.${next.messageKind}`,
    `clima.summary.next.${next.change}.generic`,
    {
      time: fmt.time(next.at, timeZone),
      target: temp(next.targetC),
      system: next.displayName,
      hasTarget: String(next.targetC != null),
    },
  );
}

export function renderSummary(f: SummaryFacts, timeZone: string): SummaryText {
  const lead =
    f.lead.temperatureC == null
      ? t('clima.summary.noTemperature', { room: f.lead.roomName })
      : t('clima.summary.roomTemperature', { room: f.lead.roomName, temperature: fmt.temp(f.lead.temperatureC) });
  const parts = f.systems.map(systemSentence);
  if (f.next) parts.push(nextSentence(f.next, timeZone));
  const rest = parts.join(' ');
  const conditions = t('clima.summary.conditions', {
    humidity: pct(f.conditions.humidityPct),
    outdoor: temp(f.conditions.outdoorC),
    outdoorHumidity: pct(f.conditions.outdoorHumidityPct),
  });
  return { lead, rest, conditions, full: rest ? `${lead} ${rest}` : lead };
}
