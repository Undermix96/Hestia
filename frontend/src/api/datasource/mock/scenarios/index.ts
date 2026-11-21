// Scenario registry of the mock data source.
import type { ScenarioId } from '../../types';
import { homeScenario } from './home';
import { manyRoomsScenario } from './manyRooms';
import { noProgramScenario } from './noProgram';
import { perSlotScenario } from './perSlot';
import { readonlyScenario } from './readonly';
import type { MockScenario } from './types';

export type { MockBehavior, MockPowerDef, MockRoomDef, MockScenario, MockSensorDef, MockSystemDef } from './types';

const BUILDERS: Record<ScenarioId, () => MockScenario> = {
  home: homeScenario,
  perSlot: perSlotScenario,
  readonly: readonlyScenario,
  noProgram: noProgramScenario,
  manyRooms: manyRoomsScenario,
};

/** A fresh deep copy of the scenario (callers may mutate it). */
export function getScenario(id: ScenarioId): MockScenario {
  return BUILDERS[id]();
}
