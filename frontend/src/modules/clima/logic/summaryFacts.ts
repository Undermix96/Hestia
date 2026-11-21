// Facts behind the room summary sentence (HANDOFF §7), generic per kind and i18n-free: the UI turns each fact
// into a message with `clima.summary.system.<type>.<messageKind>` keys (`clima.summary.next.<change>.<messageKind>`).
import type {
  Action,
  Mode,
  NextProgramChange,
  ProgramRepresentation,
  RoomTimeline,
  RoomView,
  SystemBehavior,
  SystemView,
} from '../../../api/types';
import { kindSpec, type MessageKind } from '../systemKinds';

export interface SummarySystemInput {
  systemId: string;
  kind: string;
  displayName: string;
  behavior: SystemBehavior;
  hysteresis: { belowC: number; aboveC: number };
  representation: ProgramRepresentation;
  mode: Mode | null;
  action: Action | null;
  targetC: number | null;
  nextChange: NextProgramChange | null;
}

export interface SummaryInput {
  roomName: string;
  temperatureC: number | null;
  humidityPct: number | null;
  outdoorC: number | null;
  outdoorHumidityPct: number | null;
  /** lane order */
  systems: SummarySystemInput[];
}

export type SystemFactState =
  | { type: 'heatingTowards'; targetC: number | null; overshoot: boolean }
  | { type: 'coolingTowards'; targetC: number | null }
  | { type: 'drying' }
  | { type: 'aboveTarget'; targetC: number }
  | { type: 'inRange'; temperatureC: number; lowC: number; highC: number }
  | { type: 'standby'; targetC: number | null }
  | { type: 'notScheduled' }
  | { type: 'off' }
  | { type: 'unknown' };

export type SystemFactType = SystemFactState['type'];

export interface SystemFact {
  systemId: string;
  kind: string;
  messageKind: MessageKind;
  displayName: string;
  state: SystemFactState;
}

export interface NextChangeFact {
  systemId: string;
  kind: string;
  messageKind: MessageKind;
  displayName: string;
  at: string;
  change: 'target' | 'on' | 'off';
  targetC: number | null;
}

export interface SummaryFacts {
  lead: { roomName: string; temperatureC: number | null };
  systems: SystemFact[];
  next: NextChangeFact | null;
  conditions: { humidityPct: number | null; outdoorC: number | null; outdoorHumidityPct: number | null };
}

export function summaryInputFromTimeline(
  tl: RoomTimeline,
  names: { room: (r: RoomView) => string; system: (s: SystemView) => string },
): SummaryInput {
  const now = tl.grid.nowIndex;
  return {
    roomName: names.room(tl.room),
    temperatureC: tl.climate.measuredC[now] ?? null,
    humidityPct: tl.climate.measuredHumidityPct[now] ?? null,
    outdoorC: tl.outdoor.nowC,
    outdoorHumidityPct: tl.outdoor.nowHumidityPct,
    systems: tl.lanes.map((lane) => {
      const view = tl.systems.find((s) => s.id === lane.systemId);
      if (!view) throw new Error(`No system view for lane ${lane.systemId}`);
      return {
        systemId: lane.systemId,
        kind: lane.kind,
        displayName: names.system(view),
        behavior: view.behavior,
        hysteresis: { belowC: view.hysteresis.belowC, aboveC: view.hysteresis.aboveC },
        representation: lane.representation,
        mode: lane.mode[now] ?? null,
        action: lane.action[now] ?? null,
        targetC: lane.targetC[now] ?? null,
        nextChange: lane.nextChange,
      };
    }),
  };
}

/** State of one system at now. T = room temperature, t = target, hi = t + aboveC, lo = t - belowC. */
export function systemFactState(s: SummarySystemInput, temperatureC: number | null): SystemFactState {
  const T = temperatureC;
  const t = s.targetC;
  switch (s.behavior) {
    case 'always_on_target': {
      if (t == null || T == null) return { type: 'unknown' };
      const hi = t + s.hysteresis.aboveC;
      if (s.action === 'heat') return { type: 'heatingTowards', targetC: t, overshoot: T > hi };
      if (T > hi) return { type: 'aboveTarget', targetC: t };
      return { type: 'inRange', temperatureC: T, lowC: t - s.hysteresis.belowC, highC: hi };
    }
    case 'mode_based': {
      if (s.mode === 'off') return { type: 'off' };
      if (t == null) return { type: 'notScheduled' };
      if (s.action === 'heat') return { type: 'heatingTowards', targetC: t, overshoot: false };
      if (s.action === 'cool') return { type: 'coolingTowards', targetC: t };
      if (s.action === 'dry') return { type: 'drying' };
      return { type: 'standby', targetC: t };
    }
    default: {
      // 'unknown' and 'thermostatic': trust the reported action.
      switch (s.action) {
        case 'heat':
          return { type: 'heatingTowards', targetC: t, overshoot: false };
        case 'cool':
          return { type: 'coolingTowards', targetC: t };
        case 'dry':
          return { type: 'drying' };
        case 'idle':
          return { type: 'standby', targetC: t };
        case 'off':
          return s.representation !== 'none' && t == null ? { type: 'notScheduled' } : { type: 'off' };
        default:
          return { type: 'unknown' };
      }
    }
  }
}

export function summaryFacts(input: SummaryInput): SummaryFacts {
  const systems: SystemFact[] = input.systems.map((s) => ({
    systemId: s.systemId,
    kind: s.kind,
    messageKind: kindSpec(s.kind).messageKind,
    displayName: s.displayName,
    state: systemFactState(s, input.temperatureC),
  }));
  let next: NextChangeFact | null = null;
  let nextMs = Infinity;
  for (const s of input.systems) {
    if (!s.nextChange) continue;
    const ms = Date.parse(s.nextChange.at);
    if (ms < nextMs) {
      nextMs = ms;
      next = {
        systemId: s.systemId,
        kind: s.kind,
        messageKind: kindSpec(s.kind).messageKind,
        displayName: s.displayName,
        at: s.nextChange.at,
        change: s.nextChange.change,
        targetC: s.nextChange.targetC,
      };
    }
  }
  return {
    lead: { roomName: input.roomName, temperatureC: input.temperatureC },
    systems,
    next,
    conditions: { humidityPct: input.humidityPct, outdoorC: input.outdoorC, outdoorHumidityPct: input.outdoorHumidityPct },
  };
}
