// In-memory data source of M1: a faithful port of the mockup engine on a fixed clock (spec §3.3).
import type { ClimaOverview, Override, OverrideCreate, RoomTimeline, RoomView, TimeRange } from '../../types';
import { hhmmToMinutes, isoWithOffset } from '../../../lib/time';
import {
  DataSourceError,
  type DataSource,
  type OverviewQuery,
  type RoomTimelineQuery,
  type ScenarioId,
} from '../types';
import {
  buildContext,
  buildOverview,
  buildRoomTimeline,
  findRoom,
  roomViews,
  simulateScenario,
  todayAt,
  type MockContext,
  type SimulationResult,
} from './aggregate';
import { MOCK_NOW_ISO, MOCK_TIME_ZONE } from './clock';
import { buildGrid, type MockGrid } from './neng/grid';
import { effectiveProgram, sameKey, validateChange, type StoredChange } from './overrides';
import { getScenario, type MockScenario, type MockSystemDef } from './scenarios';

export interface MockDataSourceOptions {
  /** ISO instant of the fixed clock (default MOCK_NOW_ISO) */
  now?: string;
  /** IANA zone (default MOCK_TIME_ZONE) */
  timeZone?: string;
}

const CACHE_LIMIT = 24;

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

async function settle(signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) throw abortError();
  await Promise.resolve();
  if (signal?.aborted) throw abortError();
}

export class MockDataSource implements DataSource {
  readonly kind = 'mock' as const;
  readonly scenario: ScenarioId;
  readonly timeZone: string;
  private readonly nowIso: string;
  private readonly model: MockScenario;
  private readonly grids = new Map<TimeRange, MockGrid>();
  private readonly sims = new Map<string, SimulationResult>();
  private readonly results = new Map<string, unknown>();
  private readonly listeners = new Set<() => void>();
  private stored: StoredChange[] = [];
  private overridesVersion = 0;
  private nextId = 1;

  constructor(scenario: ScenarioId, options: MockDataSourceOptions = {}) {
    this.scenario = scenario;
    this.timeZone = options.timeZone ?? MOCK_TIME_ZONE;
    this.nowIso = options.now ?? MOCK_NOW_ISO;
    this.model = getScenario(scenario);
  }

  now(): Date {
    return new Date(this.nowIso);
  }

  async getRooms(signal?: AbortSignal): Promise<RoomView[]> {
    await settle(signal);
    return roomViews(this.model);
  }

  async getRoomTimeline(query: RoomTimelineQuery, signal?: AbortSignal): Promise<RoomTimeline> {
    await settle(signal);
    if (!findRoom(this.model, query.roomId)) {
      throw new DataSourceError('not_found', `Unknown room ${query.roomId}`, 404);
    }
    const draft = query.draft ?? null;
    if (draft) {
      const error = this.validate(draft);
      if (error) throw new DataSourceError('invalid_change', `Invalid draft: ${error}`, 422);
    }
    const key = `timeline|${query.roomId}|${this.cacheKey(query.range, draft)}`;
    return this.memo(key, () => buildRoomTimeline(this.context(query.range, draft), query.roomId));
  }

  async getOverview(query: OverviewQuery, signal?: AbortSignal): Promise<ClimaOverview> {
    await settle(signal);
    const key = `overview|${this.cacheKey(query.range, null)}`;
    return this.memo(key, () => buildOverview(this.context(query.range, null)));
  }

  async createOverride(body: OverrideCreate): Promise<Override> {
    await settle(undefined);
    const error = this.validate(body);
    if (error) throw new DataSourceError('invalid_change', error, 422);
    const grid = this.grid('24h');
    let validUntil: string | null = null;
    if (body.scope === 'slot') {
      const sys = this.system(body.systemId)!;
      const slot = this.committedProgram(sys).days[body.day].find((s) => s.ref === body.slotRef)!;
      validUntil = todayAt(grid, hhmmToMinutes(slot.to));
    }
    const override: Override = {
      id: `ovr-${this.nextId}`,
      systemId: body.systemId,
      slotRef: body.slotRef,
      day: body.day,
      scope: body.scope,
      change: structuredClone(body.change),
      status: 'active',
      validFrom: isoWithOffset(grid.nowMs, this.timeZone),
      validUntil,
    };
    this.nextId += 1;
    const entry: StoredChange = { override, body: structuredClone(body) };
    const index = this.stored.findIndex((c) => sameKey(c.body, body));
    if (index >= 0) this.stored = this.stored.map((c, i) => (i === index ? entry : c));
    else this.stored = [...this.stored, entry];
    this.changed();
    return structuredClone(override);
  }

  async deleteOverride(overrideId: string): Promise<void> {
    await settle(undefined);
    if (!this.stored.some((c) => c.override.id === overrideId)) {
      throw new DataSourceError('not_found', `Unknown override ${overrideId}`, 404);
    }
    this.stored = this.stored.filter((c) => c.override.id !== overrideId);
    this.changed();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // --- internals -------------------------------------------------------------------------------------------

  private changed(): void {
    this.overridesVersion += 1;
    this.sims.clear();
    this.results.clear();
    for (const l of [...this.listeners]) l();
  }

  private system(id: string): MockSystemDef | null {
    return this.model.systems.find((s) => s.id === id) ?? null;
  }

  private committedProgram(sys: MockSystemDef) {
    return effectiveProgram(
      sys.program,
      this.stored.filter((c) => c.body.systemId === sys.id).map((c) => c.body),
      sys,
    );
  }

  /** Validates a change against the committed state (a change with the same key is replaced, not stacked). */
  private validate(body: OverrideCreate): string | null {
    const sys = this.system(body.systemId);
    if (!sys) return `unknown system ${body.systemId}`;
    const others = this.stored.filter((c) => !(c.body.systemId === sys.id && sameKey(c.body, body)));
    const program = effectiveProgram(
      sys.program,
      others.filter((c) => c.body.systemId === sys.id).map((c) => c.body),
      sys,
    );
    return validateChange(body, sys, program, this.grid('24h'));
  }

  private grid(range: TimeRange): MockGrid {
    let g = this.grids.get(range);
    if (!g) {
      g = buildGrid(range, this.nowIso, this.timeZone);
      this.grids.set(range, g);
    }
    return g;
  }

  private cacheKey(range: TimeRange, draft: OverrideCreate | null): string {
    return `${range}|${this.overridesVersion}|${draft ? JSON.stringify(draft) : ''}`;
  }

  private simulation(range: TimeRange, draft: OverrideCreate | null): SimulationResult {
    const key = this.cacheKey(range, draft);
    let sim = this.sims.get(key);
    if (!sim) {
      sim = simulateScenario(this.model, this.grid(range), this.stored, draft);
      this.trim(this.sims);
      this.sims.set(key, sim);
    }
    return sim;
  }

  private context(range: TimeRange, draft: OverrideCreate | null): MockContext {
    const sim = this.simulation(range, draft);
    const sim24 = range === '24h' ? sim : this.simulation('24h', draft);
    const clock = { now: isoWithOffset(this.grid(range).nowMs, this.timeZone), timeZone: this.timeZone };
    return buildContext(this.model, clock, sim, sim24, this.stored, draft);
  }

  private memo<T>(key: string, build: () => T): T {
    let value = this.results.get(key) as T | undefined;
    if (value === undefined) {
      value = build();
      this.trim(this.results);
      this.results.set(key, value);
    }
    return structuredClone(value);
  }

  private trim(map: Map<string, unknown>): void {
    while (map.size >= CACHE_LIMIT) {
      const first = map.keys().next().value;
      if (first === undefined) break;
      map.delete(first);
    }
  }
}

