// Scenario `perSlot`: like home, with per-slot values and a weekend variant (sat/sun start at 07:30).
import { PERSLOT_RW } from './capabilities';
import { baseScenario, homeRooms, homeSystems } from './home';
import type { MockScenario } from './types';

export function perSlotScenario(): MockScenario {
  return baseScenario(
    'perSlot',
    homeRooms(),
    homeSystems(() => ({ representation: 'perSlot', preset: PERSLOT_RW, weekendShift: true })),
  );
}
