// Scenario `readonly`: home with read-only programs and no overrides.
import { LEVELS_RO } from './capabilities';
import { baseScenario, homeRooms, homeSystems, levelsVariant } from './home';
import type { MockScenario } from './types';

export function readonlyScenario(): MockScenario {
  return baseScenario('readonly', homeRooms(), homeSystems(levelsVariant(LEVELS_RO)));
}
