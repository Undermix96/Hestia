// Scenario `noProgram`: home without readable programs; radiators hold a constant target, splits are off.
import { NONE } from './capabilities';
import { baseScenario, homeRooms, homeSystems } from './home';
import type { MockScenario } from './types';

const CONSTANT_TARGET_C: Record<string, number> = {
  'z-soggiorno': 20.5,
  'z-camera': 19.0,
  'z-cameretta': 19.5,
  'z-bagno': 21.0,
  'ac-soggiorno': 21.0,
  'ac-corridoio': 21.0,
};

export function noProgramScenario(): MockScenario {
  return baseScenario(
    'noProgram',
    homeRooms(),
    homeSystems((spec) => ({
      representation: 'none',
      preset: NONE,
      constantTargetC: CONSTANT_TARGET_C[spec.id] ?? 20,
      mode: 'off',
    })),
  );
}
