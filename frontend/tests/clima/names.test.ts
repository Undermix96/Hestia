import { describe, expect, it } from 'vitest';
import { systemLowerName, systemName, systemShortName } from '../../src/modules/clima/names';

describe('system names', () => {
  const kindOnly = (kind: string) => ({ kind, name: null, nameKey: null });

  it('uses the kind forms when the system has no own name', () => {
    expect(systemName(kindOnly('radiator'))).toBe('Caloriferi');
    expect(systemShortName(kindOnly('radiator'))).toBe('caloriferi');
    expect(systemShortName(kindOnly('ac'))).toBe('clima');
    expect(systemLowerName(kindOnly('ac'))).toBe('climatizzatore');
    expect(systemShortName(kindOnly('heatPump'))).toBe('impianto');
  });

  it('uses the short and lower forms of a name key, like the kinds', () => {
    const deum = { kind: 'dehumidifier', name: null, nameKey: 'mock.system.dehumidifier' };
    expect(systemName(deum)).toBe('Deumidificatore');
    expect(systemShortName(deum)).toBe('deumidificatore');
    expect(systemLowerName(deum)).toBe('deumidificatore');
  });

  it('falls back to the plain name key message without short or lower forms', () => {
    const s = { kind: 'dehumidifier', name: null, nameKey: 'mock.room.studio' };
    expect(systemShortName(s)).toBe('Studio');
    expect(systemLowerName(s)).toBe('Studio');
  });

  it('keeps a free name as typed', () => {
    const s = { kind: 'ac', name: 'Split Daikin', nameKey: 'mock.system.dehumidifier' };
    expect(systemName(s)).toBe('Split Daikin');
    expect(systemShortName(s)).toBe('Split Daikin');
    expect(systemLowerName(s)).toBe('Split Daikin');
  });
});
