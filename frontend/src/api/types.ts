// Friendly aliases of the generated API contract (src/api/schema.d.ts, from contract/openapi.json).
import type { components } from './schema';

type Schemas = components['schemas'];

export type ApiError = Schemas['ApiError'];
export type Level = Schemas['Level'];
export type Slot = Schemas['Slot'];
export type WeekDays = Schemas['WeekDays'];
export type Program = Schemas['Program'];
export type ProgramCapabilities = Schemas['ProgramCapabilities'];
export type OverrideCapabilities = Schemas['OverrideCapabilities'];
export type DriverCapabilities = Schemas['DriverCapabilities'];
export type PowerCapabilities = Schemas['PowerCapabilities'];
export type HistoryCapabilities = Schemas['HistoryCapabilities'];
export type OutdoorCapabilities = Schemas['OutdoorCapabilities'];
export type SystemCapabilities = Schemas['SystemCapabilities'];
export type SourceCapabilities = Schemas['SourceCapabilities'];
export type Hysteresis = Schemas['Hysteresis'];
export type OverrideChange = Schemas['OverrideChange'];
export type OverrideCreate = Schemas['OverrideCreate'];
export type Override = Schemas['Override'];
export type ClockInfo = Schemas['ClockInfo'];
export type TimeGrid = Schemas['TimeGrid'];
export type RoomView = Schemas['RoomView'];
export type AdapterTypes = Schemas['AdapterTypes'];
export type SystemState = Schemas['SystemState'];
export type SystemView = Schemas['SystemView'];
export type SystemStatus = Schemas['SystemStatus'];
export type RoomStatus = Schemas['RoomStatus'];
export type RoomClimateSeries = Schemas['RoomClimateSeries'];
export type TargetSeries = Schemas['TargetSeries'];
export type ProgramSegment = Schemas['ProgramSegment'];
export type NextProgramChange = Schemas['NextProgramChange'];
export type SystemSeries = Schemas['SystemSeries'];
export type SystemLane = Schemas['SystemLane'];
export type OutdoorSeries = Schemas['OutdoorSeries'];
export type PowerSummary = Schemas['PowerSummary'];
export type RoomTimeline = Schemas['RoomTimeline'];
export type OverviewRow = Schemas['OverviewRow'];
export type ClimaOverview = Schemas['ClimaOverview'];

export type TimeRange = TimeGrid['range'];
export type Weekday = keyof WeekDays;
export type Mode = NonNullable<SystemState['mode']>;
export type Action = NonNullable<SystemState['action']>;
export type ProgramRepresentation = Program['representation'];
export type OverrideScope = Override['scope'];
export type TemporaryOverrideScope = OverrideCapabilities['scopes'][number];
export type SegmentState = ProgramSegment['state'];
export type SystemBehavior = SystemView['behavior'];

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const satisfies readonly Weekday[];
export const TIME_RANGES = ['24h', '7d'] as const satisfies readonly TimeRange[];
