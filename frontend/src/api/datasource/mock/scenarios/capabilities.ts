// Capability presets of the mock systems (spec §4.5).
import type {
  AdapterTypes,
  DriverCapabilities,
  OverrideCapabilities,
  PowerCapabilities,
  ProgramCapabilities,
  SourceCapabilities,
  SystemCapabilities,
} from '../../../types';

const OVERRIDE_SLOT: OverrideCapabilities = {
  scopes: ['slot'],
  futureSlots: false,
  step: 0.5,
  minDelta: -4,
  maxDelta: 4,
  expiry: 'external',
};
const OVERRIDE_NONE: OverrideCapabilities = { ...OVERRIDE_SLOT, scopes: [] };

export interface CapabilityPreset {
  program: ProgramCapabilities;
  override: OverrideCapabilities;
}

export const LEVELS_RW: CapabilityPreset = {
  program: {
    read: true,
    representation: 'levels',
    writeLevelValues: true,
    writeSlotValue: false,
    writeTimes: true,
    dayScope: 'perDay',
    minuteStep: 30,
    maxSlotsPerDay: 6,
  },
  override: OVERRIDE_SLOT,
};

export const PERSLOT_RW: CapabilityPreset = {
  program: {
    read: true,
    representation: 'perSlot',
    writeLevelValues: false,
    writeSlotValue: true,
    writeTimes: true,
    dayScope: 'perDay',
    minuteStep: 30,
    maxSlotsPerDay: 8,
  },
  override: OVERRIDE_SLOT,
};

export const LEVELS_RO: CapabilityPreset = {
  program: {
    read: true,
    representation: 'levels',
    writeLevelValues: false,
    writeSlotValue: false,
    writeTimes: false,
    dayScope: 'perDay',
    minuteStep: 30,
    maxSlotsPerDay: null,
  },
  override: OVERRIDE_NONE,
};

export const NONE: CapabilityPreset = {
  program: {
    read: true,
    representation: 'none',
    writeLevelValues: false,
    writeSlotValue: false,
    writeTimes: false,
    dayScope: 'all',
    minuteStep: 30,
    maxSlotsPerDay: null,
  },
  override: OVERRIDE_NONE,
};

export const ONOFF_TIMES: CapabilityPreset = {
  program: {
    read: true,
    representation: 'onOff',
    writeLevelValues: false,
    writeSlotValue: false,
    writeTimes: true,
    dayScope: 'all',
    minuteStep: 30,
    maxSlotsPerDay: 4,
  },
  override: OVERRIDE_NONE,
};

export const DRIVERS = {
  radiator: { modes: ['heat'], readsAction: true, readsTarget: true, writesMode: false, writesTarget: true },
  ac: {
    modes: ['heat', 'cool', 'dry', 'off'],
    readsAction: true,
    readsTarget: true,
    writesMode: true,
    writesTarget: true,
  },
  dehumidifier: { modes: ['dry', 'off'], readsAction: true, readsTarget: false, writesMode: false, writesTarget: false },
} as const satisfies Record<string, DriverCapabilities>;

export type DriverName = keyof typeof DRIVERS;

export function powerCapabilities(hasPower: boolean): PowerCapabilities {
  return hasPower ? { kind: 'estimated', energyTotals: false } : { kind: 'none', energyTotals: false };
}

export function systemCapabilities(preset: CapabilityPreset, driver: DriverName, hasPower: boolean): SystemCapabilities {
  const d = DRIVERS[driver];
  return {
    program: { ...preset.program },
    override: { ...preset.override, scopes: [...preset.override.scopes] },
    driver: { ...d, modes: [...d.modes] },
    power: powerCapabilities(hasPower),
  };
}

export function adapterTypes(driver: DriverName, preset: CapabilityPreset, hasPower: boolean): AdapterTypes {
  if (driver === 'dehumidifier') return { driver: 'template', program: 'template', override: 'disabled', power: null };
  const rep = preset.program.representation;
  return {
    driver: 'ha_climate',
    program: rep === 'none' ? 'none' : rep === 'perSlot' ? 'ha_schedule_data' : 'ha_schedule_levels',
    override: rep === 'none' ? 'disabled' : 'climate_direct',
    power: hasPower ? 'estimate' : null,
  };
}

export const MOCK_SOURCES: SourceCapabilities = {
  history: { maxLookbackDays: 30, resolutionMin: 30, actionHistory: true },
  outdoor: { current: true, history: true, forecastHours: 12 },
};
