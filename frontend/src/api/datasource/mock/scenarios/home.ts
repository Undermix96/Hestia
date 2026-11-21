// Scenario `home`: the house of the design handoff (spec §4.5, D7).
import { LEVELS_RW, MOCK_SOURCES, type CapabilityPreset } from './capabilities';
import { houseSystem, type HouseSystemSpec, type HouseVariant } from './builders';
import type { MockRoomDef, MockScenario, MockSystemDef } from './types';
import type { ScenarioId } from '../../types';

export function room(
  id: string,
  sensor: [seed: number, loss: number, humidityBase: number, bathroom: boolean] | null,
  extra: Partial<Pick<MockRoomDef, 'followsRoomId' | 'displayTargetSystemId'>> = {},
): MockRoomDef {
  return {
    id,
    nameKey: `mock.room.${id}`,
    sensor: sensor ? { seed: sensor[0], loss: sensor[1], humidityBase: sensor[2], bathroom: sensor[3] } : null,
    followsRoomId: extra.followsRoomId ?? null,
    displayTargetSystemId: extra.displayTargetSystemId ?? null,
  };
}

export function homeRooms(): MockRoomDef[] {
  return [
    room('soggiorno', [3, 0.032, 47, false]),
    room('corridoio', [5, 0.03, 49, false]),
    room('camera', [13, 0.028, 51, false]),
    room('cameretta', [17, 0.028, 50, false]),
    room('bagno', [19, 0.036, 60, true]),
    room('ripostiglio', null, { followsRoomId: 'bagno' }),
  ];
}

/** The six systems of the handoff house, in configuration order. */
export const HOME_SYSTEMS: readonly HouseSystemSpec[] = [
  {
    id: 'z-soggiorno',
    kind: 'radiator',
    roomIds: ['soggiorno'],
    levels: [
      ['eco', 18.5],
      ['comfort', 21],
    ],
    full: [
      [0, 18.5],
      [6, 21],
      [23, 18.5],
    ],
  },
  {
    id: 'ac-soggiorno',
    kind: 'ac',
    roomIds: ['soggiorno'],
    levels: [['setpoint', 21.5]],
    gaps: [
      [6, 8.75, 21.5],
      [16, 22, 21.5],
    ],
    power: { kwActive: 0.8, kwIdle: 0.04, kwhIdlePerSample: 0.02 },
  },
  {
    id: 'ac-corridoio',
    kind: 'ac',
    roomIds: ['corridoio'],
    levels: [['setpoint', 20.5]],
    gaps: [
      [6, 9, 20.5],
      [16, 23, 20.5],
    ],
    power: { kwActive: 0.5, kwIdle: 0.04, kwhIdlePerSample: 0.02 },
  },
  {
    id: 'z-camera',
    kind: 'radiator',
    roomIds: ['camera'],
    levels: [
      ['night', 17.5],
      ['morning', 20],
      ['day', 18],
      ['evening', 19.5],
    ],
    full: [
      [0, 17.5],
      [6, 20],
      [8, 18],
      [21, 19.5],
      [23, 17.5],
    ],
  },
  {
    id: 'z-cameretta',
    kind: 'radiator',
    roomIds: ['cameretta'],
    levels: [
      ['night', 18.5],
      ['morning', 20.5],
      ['day', 19],
      ['evening', 20],
    ],
    full: [
      [0, 18.5],
      [6, 20.5],
      [8.5, 19],
      [19, 20],
      [23, 18.5],
    ],
  },
  {
    id: 'z-bagno',
    kind: 'radiator',
    roomIds: ['bagno', 'ripostiglio'],
    levels: [
      ['night', 19],
      ['comfort', 23],
      ['day', 20],
    ],
    full: [
      [0, 19],
      [6, 23],
      [9, 20],
      [18, 23],
      [22, 19],
    ],
  },
];

export function baseScenario(id: ScenarioId, rooms: MockRoomDef[], systems: MockSystemDef[]): MockScenario {
  return {
    id,
    rooms,
    systems,
    outdoorSeed: 77,
    tariffPerKwh: 0.28,
    currency: 'EUR',
    month: { kwh: 79, cost: 22.1 },
    sources: structuredClone(MOCK_SOURCES),
  };
}

export function homeSystems(variant: (spec: HouseSystemSpec) => HouseVariant): MockSystemDef[] {
  return HOME_SYSTEMS.map((spec) => houseSystem(spec, variant(spec)));
}

export function levelsVariant(preset: CapabilityPreset): () => HouseVariant {
  return () => ({ representation: 'levels', preset });
}

export function homeScenario(): MockScenario {
  return baseScenario('home', homeRooms(), homeSystems(levelsVariant(LEVELS_RW)));
}
