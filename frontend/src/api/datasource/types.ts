import type { ClimaOverview, Override, OverrideCreate, RoomTimeline, RoomView, TimeRange } from '../types';

export type DataSourceKind = 'mock' | 'http';
export type ScenarioId = 'home' | 'perSlot' | 'readonly' | 'noProgram' | 'manyRooms';
export const SCENARIO_IDS = ['home', 'perSlot', 'readonly', 'noProgram', 'manyRooms'] as const satisfies readonly ScenarioId[];
export const DEFAULT_SCENARIO: ScenarioId = 'home';

export type DataSourceErrorCode = 'no_data_source' | 'not_found' | 'invalid_change' | 'network' | 'unexpected';

export class DataSourceError extends Error {
  readonly code: DataSourceErrorCode;
  readonly status: number | null;

  constructor(code: DataSourceErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = 'DataSourceError';
    this.code = code;
    this.status = status;
  }
}

export interface RoomTimelineQuery {
  roomId: string;
  range: TimeRange;
  /** Editor draft to preview (mock: applied like a committed override, not stored). http ignores it in M1. */
  draft?: OverrideCreate | null;
}

export interface OverviewQuery {
  range: TimeRange;
}

export interface DataSource {
  readonly kind: DataSourceKind;
  /** null for http. */
  readonly scenario: ScenarioId | null;
  /** IANA zone for wall-clock display (mock: 'Europe/Rome'). Data formatting uses clock.timeZone. */
  readonly timeZone: string;
  /** Wall clock (mock: fixed 2026-11-20T08:30:00+01:00). */
  now(): Date;
  getRooms(signal?: AbortSignal): Promise<RoomView[]>;
  getRoomTimeline(query: RoomTimelineQuery, signal?: AbortSignal): Promise<RoomTimeline>;
  getOverview(query: OverviewQuery, signal?: AbortSignal): Promise<ClimaOverview>;
  createOverride(body: OverrideCreate): Promise<Override>;
  deleteOverride(overrideId: string): Promise<void>;
  /** Called after any change to stored data (create/delete override). Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}
