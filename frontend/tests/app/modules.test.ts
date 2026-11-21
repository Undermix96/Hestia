import { beforeEach, describe, expect, it } from 'vitest';
import { withKeptSearch } from '../../src/app/keepSearch';
import {
  activeModule,
  isNavItemActive,
  matchesPrefix,
  modules,
  navItemTarget,
  visibleModules,
} from '../../src/app/modules';
import { hasMessage } from '../../src/i18n';
import { stanzaPath } from '../../src/modules/clima/paths';
import { resetClimaStore, useClimaStore } from '../../src/modules/clima/store/climaStore';
import { defaultRoomId } from '../../src/modules/clima/routes/StanzaIndex';
import { FAKE_ROOMS } from './fakeDataSource';

describe('module registry', () => {
  beforeEach(() => {
    resetClimaStore();
  });

  it('registers clima, energia and luci in this order', () => {
    expect(modules.map((m) => m.id)).toEqual(['clima', 'energia', 'luci']);
  });

  it('shows only clima in M1; energia and luci are hidden and have no routes', () => {
    expect(visibleModules().map((m) => m.id)).toEqual(['clima']);
    for (const id of ['energia', 'luci']) {
      const m = modules.find((x) => x.id === id);
      expect(m?.visible).toBe(false);
      expect(m?.routes).toEqual([]);
    }
  });

  it('every label is a catalog message', () => {
    for (const m of modules) {
      expect(hasMessage(m.labelKey), m.labelKey).toBe(true);
      for (const item of m.nav) expect(hasMessage(item.labelKey), item.labelKey).toBe(true);
    }
  });

  it('clima has the Stanza and Tutte items, a header status and its routes', () => {
    const clima = modules.find((m) => m.id === 'clima');
    expect(clima?.nav.map((i) => i.id)).toEqual(['stanza', 'tutte']);
    expect(clima?.HeaderStatus).toBeTypeOf('function');
    expect(clima?.routes.map((r) => r.path)).toEqual([
      'clima',
      'clima/stanza',
      'clima/stanza/:roomId',
      'clima/tutte',
    ]);
  });

  it('the Stanza item targets the last room shown', () => {
    const stanza = modules.find((m) => m.id === 'clima')?.nav[0];
    if (!stanza) throw new Error('missing stanza item');
    expect(navItemTarget(stanza)).toBe('/clima/stanza');
    useClimaStore.getState().setLastRoom('camera');
    expect(navItemTarget(stanza)).toBe('/clima/stanza/camera');
  });

  it('clima notifies nav changes when the last room changes', () => {
    const clima = modules.find((m) => m.id === 'clima');
    let calls = 0;
    const unsubscribe = clima?.subscribeNav?.(() => {
      calls += 1;
    });
    useClimaStore.getState().setCursor(3);
    expect(calls).toBe(0);
    useClimaStore.getState().setLastRoom('bagno');
    expect(calls).toBe(1);
    unsubscribe?.();
  });

  it('matches active prefixes by path segment', () => {
    expect(matchesPrefix('/clima/stanza', '/clima/stanza')).toBe(true);
    expect(matchesPrefix('/clima/stanza/camera', '/clima/stanza')).toBe(true);
    expect(matchesPrefix('/clima/stanzaX', '/clima/stanza')).toBe(false);
    expect(matchesPrefix('/clima/tutte', '/clima/stanza')).toBe(false);
  });

  it('finds the active module and item', () => {
    expect(activeModule('/clima/tutte')?.id).toBe('clima');
    expect(activeModule('/clima/stanza/bagno')?.id).toBe('clima');
    expect(activeModule('/energia')).toBeNull();
    expect(activeModule('/nowhere')).toBeNull();
    const tutte = modules[0]?.nav[1];
    if (!tutte) throw new Error('missing tutte item');
    expect(isNavItemActive(tutte, '/clima/tutte')).toBe(true);
    expect(isNavItemActive(tutte, '/clima/stanza/bagno')).toBe(false);
  });
});

describe('withKeptSearch', () => {
  it('keeps scenario and source only', () => {
    expect(withKeptSearch('/clima/tutte', '?scenario=perSlot&source=http&x=1')).toBe(
      '/clima/tutte?scenario=perSlot&source=http',
    );
  });

  it('leaves the path alone without kept parameters', () => {
    expect(withKeptSearch('/clima/tutte', '')).toBe('/clima/tutte');
    expect(withKeptSearch('/clima/tutte', '?x=1')).toBe('/clima/tutte');
  });

  it('parameters in the target win and the hash is kept', () => {
    expect(withKeptSearch('/a?scenario=home#top', '?scenario=readonly')).toBe('/a?scenario=home#top');
    expect(withKeptSearch('/a#top', '?scenario=readonly')).toBe('/a?scenario=readonly#top');
  });
});

describe('Stanza index', () => {
  it('stanzaPath', () => {
    expect(stanzaPath()).toBe('/clima/stanza');
    expect(stanzaPath(null)).toBe('/clima/stanza');
    expect(stanzaPath('bagno')).toBe('/clima/stanza/bagno');
  });

  it('opens the last room if it has a sensor, else the first room with a sensor', () => {
    expect(defaultRoomId(FAKE_ROOMS, null)).toBe('soggiorno');
    expect(defaultRoomId(FAKE_ROOMS, 'camera')).toBe('camera');
    expect(defaultRoomId(FAKE_ROOMS, 'ripostiglio')).toBe('soggiorno');
    expect(defaultRoomId(FAKE_ROOMS, 'gone')).toBe('soggiorno');
    expect(defaultRoomId([], null)).toBeNull();
  });
});
