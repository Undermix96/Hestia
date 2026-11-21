// Room simulation of the mockup (port of Neng.js `sim(ri, st)`), generalised to any list of systems.
import type { Action, Mode } from '../../../types';
import type { SlotOccurrence } from '../../../../modules/clima/logic/segments';
import type { MockRoomDef, MockSystemDef } from '../scenarios/types';
import type { MockGrid } from './grid';
import type { OutdoorSim } from './outdoor';
import { rng } from './rng';

/** Effective program value of a system at one sample. */
export interface SampleValue {
  /** effective target (program + permanent changes + slot overrides + draft) */
  targetC: number | null;
  on: boolean | null;
  slot: SlotOccurrence | null;
  /** value of the program without temporary overrides and without the draft */
  programmedTargetC: number | null;
  /** committed override that changed this sample (permanent ones included) */
  overrideId: string | null;
  /** the editor draft changed this sample */
  draft: boolean;
}

export interface SimSystemInput {
  def: MockSystemDef;
  /** overrides only apply for k >= nowIndex */
  valueAt(k: number): SampleValue;
}

export interface SimSystemOutput {
  systemId: string;
  target: (number | null)[];
  action: (Action | null)[];
  mode: (Mode | null)[];
  on: (boolean | null)[];
  slot: (SlotOccurrence | null)[];
  programmedTarget: (number | null)[];
  overrideId: (string | null)[];
  draft: boolean[];
}

export interface RoomSimOutput {
  roomId: string;
  T: number[];
  H: number[];
  systems: SimSystemOutput[];
}

function emptyOutput(systemId: string): SimSystemOutput {
  return { systemId, target: [], action: [], mode: [], on: [], slot: [], programmedTarget: [], overrideId: [], draft: [] };
}

function push(out: SimSystemOutput, v: SampleValue, target: number | null, action: Action | null, mode: Mode | null): void {
  out.target.push(target);
  out.action.push(action);
  out.mode.push(mode);
  out.on.push(v.on);
  out.slot.push(v.slot);
  out.programmedTarget.push(v.programmedTargetC);
  out.overrideId.push(v.overrideId);
  out.draft.push(v.draft);
}

/**
 * Simulates one sensor room. `systems` are the systems whose primary room is this room, in lane order.
 * Keep the arithmetic order: the result is bitwise identical to the mockup for its rooms.
 */
export function simulateRoom(
  room: MockRoomDef,
  systems: readonly SimSystemInput[],
  grid: MockGrid,
  outdoor: OutdoorSim,
): RoomSimOutput {
  const sensor = room.sensor;
  if (!sensor) throw new Error(`Room ${room.id} has no sensor to simulate`);
  const g = rng(sensor.seed * 13 + 1);
  const outputs = systems.map((s) => emptyOutput(s.def.id));
  const res: RoomSimOutput = { roomId: room.id, T: [], H: [], systems: outputs };
  const n = systems.length;
  const heatOn: boolean[] = new Array<boolean>(n).fill(false); // rh / ah of the mockup
  const values: SampleValue[] = new Array<SampleValue>(n);
  const targets: (number | null)[] = new Array<number | null>(n).fill(null);
  const actions: (Action | null)[] = new Array<Action | null>(n).fill(null);
  let T: number | null = null;

  for (let k = -grid.warmup; k < grid.count; k += 1) {
    const i = Math.max(0, k);
    const h = grid.hourAt(k);
    const fut = k >= grid.nowIndex;
    const to = outdoor.T[i] ?? 0;

    for (let s = 0; s < n; s += 1) {
      const sys = systems[s]!;
      const v = sys.valueAt(k);
      values[s] = v;
      if (sys.def.behavior === 'mode_based') targets[s] = sys.def.mode === 'off' || v.targetC == null ? null : v.targetC;
      else if (sys.def.behavior === 'always_on_target') targets[s] = v.targetC;
      else targets[s] = v.targetC;
    }

    if (T == null) {
      // exactly `rt || as || 20`
      let init = 0;
      for (let s = 0; s < n && !init; s += 1) if (systems[s]!.def.behavior === 'always_on_target') init = targets[s] || 0;
      for (let s = 0; s < n && !init; s += 1) if (systems[s]!.def.behavior === 'mode_based') init = targets[s] || 0;
      T = init || 20;
    }

    for (let s = 0; s < n; s += 1) {
      const def = systems[s]!.def;
      const t = targets[s] ?? null;
      const { belowC, aboveC } = def.hysteresis;
      if (def.behavior === 'always_on_target') {
        if (t != null) {
          if (T < t - belowC) heatOn[s] = true;
          else if (T > t + aboveC) heatOn[s] = false;
        } else heatOn[s] = false;
        actions[s] = t == null ? null : heatOn[s] ? 'heat' : 'idle';
      } else if (def.behavior === 'mode_based') {
        let a: Action = 'off';
        if (t != null) {
          if (def.mode === 'cool') a = T > t + 0.3 ? 'cool' : 'idle';
          else if (def.mode === 'dry') a = 'dry';
          else {
            if (T < t - belowC) heatOn[s] = true;
            else if (T > t + aboveC) heatOn[s] = false;
            a = heatOn[s] ? 'heat' : 'idle';
          }
        } else heatOn[s] = false;
        actions[s] = a;
      } else {
        actions[s] = values[s]!.on === true ? 'dry' : 'off';
      }
    }

    // Temperature step (accumulation order kept for bitwise parity with the oracle).
    let inc = 0;
    for (let s = 0; s < n; s += 1) if (systems[s]!.def.behavior === 'always_on_target') inc += heatOn[s] ? 0.42 : 0;
    for (let s = 0; s < n; s += 1) if (systems[s]!.def.behavior === 'mode_based') inc += actions[s] === 'heat' ? 0.38 : 0;
    for (let s = 0; s < n; s += 1) if (systems[s]!.def.behavior === 'mode_based') inc -= actions[s] === 'cool' ? 0.35 : 0;
    inc += fut ? 0 : (g() - 0.5) * 0.05;
    inc -= (T - (to * 0.35 + 12)) * sensor.loss;
    T += inc;

    // Humidity (after the temperature step: T noise first, then humidity noise).
    let hu = sensor.humidityBase + 2 * Math.sin(((h - 4) / 24) * 2 * Math.PI) + (fut ? 0 : (g() - 0.5) * 1.5);
    if (sensor.bathroom) {
      if (h >= 7.5 && h < 8.5) hu += 14 - (h - 7.5) * 6;
      if (h >= 20 && h < 21) hu += 10 - (h - 20) * 6;
    }
    for (let s = 0; s < n; s += 1) if (systems[s]!.def.behavior === 'mode_based' && actions[s] === 'heat') hu -= 1.5;
    for (let s = 0; s < n; s += 1) if (systems[s]!.def.behavior !== 'always_on_target' && actions[s] === 'dry') hu -= 5;

    if (k >= 0) {
      res.T.push(T);
      res.H.push(hu);
      for (let s = 0; s < n; s += 1) {
        const def = systems[s]!.def;
        push(outputs[s]!, values[s]!, targets[s] ?? null, actions[s] ?? null, def.mode);
      }
    }
  }
  return res;
}

/** Systems whose primary room has no sensor: program values only, no action information. */
export function systemsOnly(systems: readonly SimSystemInput[], grid: MockGrid): SimSystemOutput[] {
  return systems.map((sys) => {
    const out = emptyOutput(sys.def.id);
    for (let k = 0; k < grid.count; k += 1) {
      const v = sys.valueAt(k);
      const t = sys.def.behavior === 'mode_based' && sys.def.mode === 'off' ? null : v.targetC;
      push(out, v, t, null, sys.def.mode);
    }
    return out;
  });
}
