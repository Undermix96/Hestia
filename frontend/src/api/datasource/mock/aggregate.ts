// Builds the contract aggregates (RoomTimeline, ClimaOverview) from the mock simulation (spec §4.6, §4.8).
import type {
  ClimaOverview,
  ClockInfo,
  OverrideCreate,
  OverviewRow,
  PowerSummary,
  RoomClimateSeries,
  RoomStatus,
  RoomTimeline,
  RoomView,
  SystemLane,
  SystemSeries,
  SystemStatus,
  SystemView,
  TargetSeries,
  TimeGrid,
} from '../../types';
import { isoWithOffset, localParts, localToEpoch } from '../../../lib/time';
import { buildSegments } from '../../../modules/clima/logic/segments';
import { kindSpec, sortByLaneOrder } from '../../../modules/clima/systemKinds';
import { timeGrid, type MockGrid } from './neng/grid';
import { outdoorSeries, simulateOutdoor, type OutdoorSim } from './neng/outdoor';
import { simulateRoom, systemsOnly, type SimSystemOutput } from './neng/simulate';
import type { StoredChange } from './overrides';
import { nextChange } from './programs';
import type { MockRoomDef, MockScenario, MockSystemDef } from './scenarios/types';
import { systemValues, type SystemPrograms } from './values';

/** One simulation of a scenario for one range, with the committed changes and an optional draft. */
export interface MockContext {
  scenario: MockScenario;
  clock: ClockInfo;
  grid: MockGrid;
  timeGrid: TimeGrid;
  outdoor: OutdoorSim;
  sims: Map<string, { T: number[]; H: number[] }>;
  systems: Map<string, SimSystemOutput>;
  programs: Map<string, SystemPrograms>;
  overrides: StoredChange[];
  draft: OverrideCreate | null;
  power: PowerSummary;
}

export function primaryRoomId(sys: MockSystemDef, rooms: readonly MockRoomDef[]): string {
  for (const id of sys.roomIds) if (rooms.find((r) => r.id === id)?.sensor) return id;
  return sys.roomIds[0]!;
}

/** Systems serving a room, configuration order. */
function servingSystems(scenario: MockScenario, roomId: string): MockSystemDef[] {
  return scenario.systems.filter((s) => s.roomIds.includes(roomId));
}

export interface SimulationResult {
  grid: MockGrid;
  outdoor: OutdoorSim;
  sims: Map<string, { T: number[]; H: number[] }>;
  systems: Map<string, SimSystemOutput>;
  programs: Map<string, SystemPrograms>;
}

export function simulateScenario(
  scenario: MockScenario,
  grid: MockGrid,
  overrides: readonly StoredChange[],
  draft: OverrideCreate | null,
): SimulationResult {
  const outdoor = simulateOutdoor(grid, scenario.outdoorSeed);
  const values = new Map(scenario.systems.map((s) => [s.id, systemValues(s, grid, overrides, draft)]));
  const sims = new Map<string, { T: number[]; H: number[] }>();
  const systems = new Map<string, SimSystemOutput>();
  const programs = new Map<string, SystemPrograms>();
  for (const v of values.values()) programs.set(v.def.id, v.programs);
  for (const room of scenario.rooms) {
    const own = sortByLaneOrder(scenario.systems.filter((s) => primaryRoomId(s, scenario.rooms) === room.id));
    const inputs = own.map((s) => values.get(s.id)!);
    if (room.sensor) {
      const out = simulateRoom(room, inputs, grid, outdoor);
      sims.set(room.id, { T: out.T, H: out.H });
      for (const s of out.systems) systems.set(s.systemId, s);
    } else {
      for (const s of systemsOnly(inputs, grid)) systems.set(s.systemId, s);
    }
  }
  return { grid, outdoor, sims, systems, programs };
}

/** Port of the mockup's energy block, always on the 24h simulation (D8). */
export function powerSummary(scenario: MockScenario, sim24: SimulationResult): PowerSummary {
  const nowi = sim24.grid.nowIndex;
  const powered = scenario.systems.filter((s) => s.power != null);
  const unmeasuredKinds: string[] = [];
  for (const s of scenario.systems) if (s.power == null && !unmeasuredKinds.includes(s.kind)) unmeasuredKinds.push(s.kind);
  const month = localParts(sim24.grid.nowMs, sim24.grid.timeZone).month;
  if (powered.length === 0) {
    return {
      kind: 'none',
      nowKw: null,
      last24HKwh: null,
      last24HCost: null,
      month,
      monthKwh: null,
      monthCost: null,
      currency: scenario.currency,
      tariffPerKwh: scenario.tariffPerKwh,
      measuredSystemIds: [],
      unmeasuredKinds,
    };
  }
  let kwh = 0;
  let kwNow = 0;
  for (const s of powered) {
    const p = s.power!;
    const actions = sim24.systems.get(s.id)?.action ?? [];
    for (let z = 0; z < nowi; z += 1) {
      const a = actions[z];
      kwh += a === 'heat' || a === 'cool' || a === 'dry' ? p.kwActive * 0.5 : a === 'idle' ? p.kwhIdlePerSample : 0;
    }
    const a2 = actions[nowi];
    kwNow += a2 === 'heat' || a2 === 'cool' || a2 === 'dry' ? p.kwActive : a2 === 'idle' ? p.kwIdle : 0;
  }
  return {
    kind: 'estimated',
    nowKw: kwNow,
    last24HKwh: kwh,
    last24HCost: kwh * scenario.tariffPerKwh,
    month,
    monthKwh: scenario.month.kwh,
    monthCost: scenario.month.cost,
    currency: scenario.currency,
    tariffPerKwh: scenario.tariffPerKwh,
    measuredSystemIds: [],
    unmeasuredKinds,
  };
}

export function buildContext(
  scenario: MockScenario,
  clock: ClockInfo,
  sim: SimulationResult,
  sim24: SimulationResult,
  overrides: StoredChange[],
  draft: OverrideCreate | null,
): MockContext {
  return {
    scenario,
    clock,
    grid: sim.grid,
    timeGrid: timeGrid(sim.grid),
    outdoor: sim.outdoor,
    sims: sim.sims,
    systems: sim.systems,
    programs: sim.programs,
    overrides,
    draft,
    power: powerSummary(scenario, sim24),
  };
}

function roomView(scenario: MockScenario, room: MockRoomDef): RoomView {
  return {
    id: room.id,
    name: null,
    nameKey: room.nameKey,
    hasSensor: room.sensor != null,
    followsRoomId: room.followsRoomId,
    systemIds: servingSystems(scenario, room.id).map((s) => s.id),
    displayTargetSystemId: room.displayTargetSystemId,
  };
}

export function roomViews(scenario: MockScenario): RoomView[] {
  return scenario.rooms.map((r) => roomView(scenario, r));
}

function output(ctx: MockContext, systemId: string): SimSystemOutput {
  const out = ctx.systems.get(systemId);
  if (!out) throw new Error(`No simulation output for ${systemId}`);
  return out;
}

function climateSeries(ctx: MockContext, roomId: string): RoomClimateSeries {
  const nowi = ctx.grid.nowIndex;
  const sim = ctx.sims.get(roomId);
  const n = ctx.grid.count;
  if (!sim) {
    const none = () => new Array<number | null>(n).fill(null);
    return { measuredC: none(), forecastC: none(), measuredHumidityPct: none(), forecastHumidityPct: none() };
  }
  const past = (v: number, i: number) => (i <= nowi ? v : null);
  const fut = (v: number, i: number) => (i >= nowi ? v : null);
  return {
    measuredC: sim.T.map(past),
    forecastC: sim.T.map(fut),
    measuredHumidityPct: sim.H.map(past),
    forecastHumidityPct: sim.H.map(fut),
  };
}

function targetSeries(ctx: MockContext, room: MockRoomDef): TargetSeries {
  const configOrder = servingSystems(ctx.scenario, room.id);
  const candidates = configOrder
    .map((s, index) => ({
      s,
      index,
      order: s.id === room.displayTargetSystemId ? -1 : kindSpec(s.kind).laneOrder,
    }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((c) => c.s);
  const out: TargetSeries = { targetC: [], comfortLowC: [], comfortHighC: [], sourceSystemIds: [] };
  for (let i = 0; i < ctx.grid.count; i += 1) {
    let picked: MockSystemDef | null = null;
    let t: number | null = null;
    for (const s of candidates) {
      const v = output(ctx, s.id).target[i] ?? null;
      if (v != null) {
        picked = s;
        t = v;
        break;
      }
    }
    out.targetC.push(t);
    out.comfortLowC.push(t != null && picked ? t - picked.hysteresis.belowC : null);
    out.comfortHighC.push(t != null && picked ? t + picked.hysteresis.aboveC : null);
    out.sourceSystemIds.push(picked?.id ?? null);
  }
  return out;
}

function systemSeries(ctx: MockContext, sys: MockSystemDef): SystemSeries {
  const out = output(ctx, sys.id);
  return {
    systemId: sys.id,
    kind: sys.kind,
    name: sys.name,
    nameKey: sys.nameKey,
    targetC: [...out.target],
    action: [...out.action],
    mode: [...out.mode],
  };
}

function programsOf(ctx: MockContext, sys: MockSystemDef): SystemPrograms {
  const p = ctx.programs.get(sys.id);
  if (!p) throw new Error(`No program for ${sys.id}`);
  return p;
}

function systemLane(ctx: MockContext, sys: MockSystemDef): SystemLane {
  const out = output(ctx, sys.id);
  const { preview } = programsOf(ctx, sys);
  const grid = ctx.timeGrid;
  const segments =
    preview.representation === 'none'
      ? []
      : buildSegments({
          systemId: sys.id,
          count: grid.count,
          nowIndex: grid.nowIndex,
          t: grid.t,
          end: grid.end,
          slot: out.slot,
          target: out.target,
          on: out.on,
          programmedTarget: out.programmedTarget,
          overrideId: out.overrideId,
          draft: out.draft,
        });
  return {
    ...systemSeries(ctx, sys),
    representation: preview.representation,
    segments,
    nextChange: nextChange(sys, ctx.grid, preview),
  };
}

function systemView(ctx: MockContext, sys: MockSystemDef): SystemView {
  const out = output(ctx, sys.id);
  const nowi = ctx.grid.nowIndex;
  return {
    id: sys.id,
    kind: sys.kind,
    name: sys.name,
    nameKey: sys.nameKey,
    roomIds: [...sys.roomIds],
    primaryRoomId: primaryRoomId(sys, ctx.scenario.rooms),
    behavior: sys.behavior,
    hysteresis: { ...sys.hysteresis },
    capabilities: structuredClone(sys.capabilities),
    program: sys.capabilities.program.read ? structuredClone(programsOf(ctx, sys).committed) : null,
    state: { mode: out.mode[nowi] ?? null, action: out.action[nowi] ?? null, targetC: out.target[nowi] ?? null },
    adapters: { ...sys.adapters },
  };
}

function roomStatus(ctx: MockContext, room: MockRoomDef): RoomStatus {
  const nowi = ctx.grid.nowIndex;
  const sim = ctx.sims.get(room.id);
  const systems: SystemStatus[] = sortByLaneOrder(servingSystems(ctx.scenario, room.id)).map((s) => {
    const out = output(ctx, s.id);
    const primary = primaryRoomId(s, ctx.scenario.rooms);
    return {
      systemId: s.id,
      kind: s.kind,
      name: s.name,
      nameKey: s.nameKey,
      action: out.action[nowi] ?? null,
      mode: out.mode[nowi] ?? null,
      targetC: out.target[nowi] ?? null,
      viaRoomId: primary !== room.id ? primary : null,
    };
  });
  return {
    roomId: room.id,
    name: null,
    nameKey: room.nameKey,
    hasSensor: room.sensor != null,
    followsRoomId: room.followsRoomId,
    temperatureC: sim ? (sim.T[nowi] ?? null) : null,
    humidityPct: sim ? (sim.H[nowi] ?? null) : null,
    systems,
  };
}

export function findRoom(scenario: MockScenario, roomId: string): MockRoomDef | null {
  return scenario.rooms.find((r) => r.id === roomId) ?? null;
}

export function buildRoomTimeline(ctx: MockContext, roomId: string): RoomTimeline {
  const room = findRoom(ctx.scenario, roomId);
  if (!room) throw new Error(`Unknown room ${roomId}`);
  const serving = sortByLaneOrder(servingSystems(ctx.scenario, room.id));
  const ids = new Set(serving.map((s) => s.id));
  return {
    clock: { ...ctx.clock },
    grid: { ...ctx.timeGrid, t: [...ctx.timeGrid.t] },
    room: roomView(ctx.scenario, room),
    rooms: ctx.scenario.rooms.map((r) => roomStatus(ctx, r)),
    climate: climateSeries(ctx, room.id),
    target: targetSeries(ctx, room),
    lanes: serving.map((s) => systemLane(ctx, s)),
    outdoor: outdoorSeries(ctx.outdoor, ctx.grid.nowIndex),
    power: structuredClone(ctx.power),
    systems: serving.map((s) => systemView(ctx, s)),
    overrides: ctx.overrides.filter((o) => ids.has(o.override.systemId)).map((o) => structuredClone(o.override)),
    sources: structuredClone(ctx.scenario.sources),
  };
}

export function buildOverview(ctx: MockContext): ClimaOverview {
  const rows: OverviewRow[] = ctx.scenario.rooms.map((room) => ({
    room: roomView(ctx.scenario, room),
    status: roomStatus(ctx, room),
    climate: room.sensor ? climateSeries(ctx, room.id) : null,
    target: room.sensor ? targetSeries(ctx, room) : null,
    systems: sortByLaneOrder(servingSystems(ctx.scenario, room.id)).map((s) => systemSeries(ctx, s)),
  }));
  return {
    clock: { ...ctx.clock },
    grid: { ...ctx.timeGrid, t: [...ctx.timeGrid.t] },
    rows,
    outdoor: outdoorSeries(ctx.outdoor, ctx.grid.nowIndex),
    sources: structuredClone(ctx.scenario.sources),
  };
}

/** ISO of a local wall time (minutes since midnight, may be 1440) on the local date of now. */
export function todayAt(grid: MockGrid, minutes: number): string {
  const p = grid.partsAt(grid.nowIndex);
  return isoWithOffset(localToEpoch(p.year, p.month, p.day, minutes, grid.timeZone), grid.timeZone);
}
