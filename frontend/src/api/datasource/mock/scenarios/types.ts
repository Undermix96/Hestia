// Scenario definitions of the mock data source (spec §4.5).
import type { AdapterTypes, Mode, Program, SourceCapabilities, SystemCapabilities } from '../../../types';
import type { ScenarioId } from '../../types';

export interface MockSensorDef {
  seed: number;
  loss: number;
  humidityBase: number;
  bathroom: boolean;
}

export interface MockRoomDef {
  id: string;
  nameKey: string;
  sensor: MockSensorDef | null;
  followsRoomId: string | null;
  displayTargetSystemId: string | null;
}

export type MockBehavior = 'always_on_target' | 'mode_based' | 'unknown';

export interface MockPowerDef {
  kwActive: number;
  kwIdle: number;
  kwhIdlePerSample: number;
}

export interface MockSystemDef {
  id: string;
  kind: string;
  name: string | null;
  nameKey: string | null;
  /** primary room = first with a sensor */
  roomIds: string[];
  behavior: MockBehavior;
  hysteresis: { belowC: number; aboveC: number };
  /** mode_based only */
  mode: Mode | null;
  program: Program;
  /** used when program.representation === 'none' */
  constantTargetC: number | null;
  capabilities: SystemCapabilities;
  adapters: AdapterTypes;
  /** null → power.kind 'none' (not measured) */
  power: MockPowerDef | null;
}

export interface MockScenario {
  id: ScenarioId;
  rooms: MockRoomDef[];
  systems: MockSystemDef[];
  outdoorSeed: number;
  tariffPerKwh: number;
  currency: string;
  month: { kwh: number; cost: number };
  sources: SourceCapabilities;
}
