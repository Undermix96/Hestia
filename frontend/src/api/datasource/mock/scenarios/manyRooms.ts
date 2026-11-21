// Scenario `manyRooms`: 10 rooms (8 with sensor), a room with 3 systems and a kind without a frontend spec.
import { adapterTypes, LEVELS_RO, LEVELS_RW, ONOFF_TIMES, PERSLOT_RW, systemCapabilities } from './capabilities';
import { houseSystem, MOCK_PROGRAM_VERSION, onOffDaySlots, week, type HouseSystemSpec } from './builders';
import { baseScenario, HOME_SYSTEMS, room } from './home';
import type { MockScenario, MockSystemDef } from './types';

function homeSystem(id: string): HouseSystemSpec {
  const spec = HOME_SYSTEMS.find((s) => s.id === id);
  if (!spec) throw new Error(`Unknown home system ${id}`);
  return spec;
}

function dehumidifier(): MockSystemDef {
  return {
    id: 'deum-soggiorno',
    kind: 'dehumidifier',
    name: null,
    nameKey: 'mock.system.dehumidifier',
    roomIds: ['soggiorno'],
    behavior: 'unknown',
    hysteresis: { belowC: 0.3, aboveC: 0.2 },
    mode: null,
    program: {
      representation: 'onOff',
      levels: null,
      days: week((day) =>
        onOffDaySlots(day, [
          [10, 12],
          [14, 18],
        ]),
      ),
      version: MOCK_PROGRAM_VERSION,
    },
    constantTargetC: null,
    capabilities: systemCapabilities(ONOFF_TIMES, 'dehumidifier', false),
    adapters: adapterTypes('dehumidifier', ONOFF_TIMES, false),
    power: null,
  };
}

export function manyRoomsScenario(): MockScenario {
  const levels = { representation: 'levels', preset: LEVELS_RW } as const;
  const systems: MockSystemDef[] = [
    houseSystem(homeSystem('z-soggiorno'), levels),
    houseSystem(homeSystem('ac-soggiorno'), levels),
    dehumidifier(),
    houseSystem(
      {
        id: 'z-cucina',
        kind: 'radiator',
        roomIds: ['cucina'],
        levels: [
          ['eco', 18.5],
          ['comfort', 20.5],
        ],
        full: [
          [0, 18.5],
          [6.5, 20.5],
          [21.5, 18.5],
        ],
      },
      levels,
    ),
    houseSystem(homeSystem('ac-corridoio'), levels),
    houseSystem(homeSystem('z-camera'), levels),
    houseSystem(homeSystem('z-cameretta'), levels),
    houseSystem(
      {
        id: 'z-studio',
        kind: 'radiator',
        roomIds: ['studio'],
        levels: [],
        full: [
          [0, 18],
          [8, 20.5],
          [13, 19.5],
          [14, 20.5],
          [19, 18],
        ],
      },
      { representation: 'perSlot', preset: PERSLOT_RW },
    ),
    houseSystem(homeSystem('z-bagno'), levels),
    houseSystem(
      {
        id: 'z-bagno2',
        kind: 'radiator',
        roomIds: ['bagno2', 'lavanderia'],
        levels: [
          ['night', 19],
          ['comfort', 22],
        ],
        full: [
          [0, 19],
          [6, 22],
          [8, 19],
          [19, 22],
          [21, 19],
        ],
      },
      { representation: 'levels', preset: LEVELS_RO },
    ),
  ];
  const rooms = [
    room('soggiorno', [3, 0.032, 47, false], { displayTargetSystemId: 'ac-soggiorno' }),
    room('cucina', [23, 0.03, 55, false]),
    room('corridoio', [5, 0.03, 49, false]),
    room('camera', [13, 0.028, 51, false]),
    room('cameretta', [17, 0.028, 50, false]),
    room('studio', [29, 0.03, 48, false]),
    room('bagno', [19, 0.036, 60, true]),
    room('ripostiglio', null, { followsRoomId: 'bagno' }),
    room('bagno2', [31, 0.036, 58, true]),
    room('lavanderia', null, { followsRoomId: 'bagno2' }),
  ];
  return baseScenario('manyRooms', rooms, systems);
}
