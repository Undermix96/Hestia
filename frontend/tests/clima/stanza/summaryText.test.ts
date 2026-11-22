// renderSummary on mock `home` reproduces the mockup's sentence (oracle hero.lead + hero.rest, hero.fc).
import { describe, expect, it } from 'vitest';
import { MockDataSource } from '../../../src/api/datasource/mock/MockDataSource';
import type { TimeRange } from '../../../src/api/types';
import {
  summaryFacts,
  summaryInputFromTimeline,
  type SummaryFacts,
} from '../../../src/modules/clima/logic/summaryFacts';
import { roomName, systemName } from '../../../src/modules/clima/names';
import { renderSummary } from '../../../src/modules/clima/screens/Stanza/summaryText';
import { loadStanzaOracle, ORACLE_ROOMS } from '../oracle/loadMockup';

const TZ = 'Europe/Rome';

describe('renderSummary', () => {
  it.each([
    ['24h', '24h'],
    ['7d', '7g'],
  ] as [TimeRange, '24h' | '7g'][])('matches the mockup for every room of home (%s)', async (range, oracleRange) => {
    const ds = new MockDataSource('home');
    const oracle = loadStanzaOracle();
    for (const [ri, roomId] of ORACLE_ROOMS.entries()) {
      const tl = await ds.getRoomTimeline({ roomId, range });
      const text = renderSummary(
        summaryFacts(summaryInputFromTimeline(tl, { room: roomName, system: systemName })),
        TZ,
      );
      const hero = oracle.render({ room: ri, hi: null, range: oracleRange }).hero;
      expect(text.full).toBe(`${hero.lead.trim()} ${hero.rest.trim()}`);
      expect(text.lead).toBe(hero.lead.trim());
      expect(text.conditions).toBe(hero.fc);
    }
  });

  it('gives the expected soggiorno sentence (spec §7.2)', async () => {
    const tl = await new MockDataSource('home').getRoomTimeline({ roomId: 'soggiorno', range: '24h' });
    const text = renderSummary(summaryFacts(summaryInputFromTimeline(tl, { room: roomName, system: systemName })), TZ);
    expect(text.full).toBe(
      'Soggiorno è a 21,8°. I caloriferi sono fermi: la stanza è sopra il target di 21,0°. Il climatizzatore scalda verso 21,5°. Alle 08:45 il climatizzatore si spegne.',
    );
    expect(text.conditions).toBe('Umidità 47% · fuori 5,9° e 83%.');
  });

  const base: SummaryFacts = {
    lead: { roomName: 'Studio', temperatureC: null },
    systems: [],
    next: null,
    conditions: { humidityPct: null, outdoorC: null, outdoorHumidityPct: null },
  };

  it('handles missing values and an empty system list', () => {
    const text = renderSummary(base, TZ);
    expect(text.lead).toBe('Studio: temperatura non disponibile.');
    expect(text.rest).toBe('');
    expect(text.full).toBe(text.lead);
    expect(text.conditions).toBe('Umidità —% · fuori —° e —%.');
  });

  it('falls back to the generic message for kinds and states without a dedicated one', () => {
    const text = renderSummary(
      {
        ...base,
        lead: { roomName: 'Studio', temperatureC: 20 },
        systems: [
          // radiator has no `standby` message, a dehumidifier kind has none at all
          {
            systemId: 'r',
            kind: 'radiator',
            messageKind: 'radiator',
            displayName: 'Caloriferi',
            state: { type: 'standby', targetC: 20 },
          },
          {
            systemId: 'd',
            kind: 'dehumidifier',
            messageKind: 'generic',
            displayName: 'Deumidificatore',
            state: { type: 'drying' },
          },
          {
            systemId: 'a',
            kind: 'ac',
            messageKind: 'ac',
            displayName: 'Climatizzatore',
            state: { type: 'coolingTowards', targetC: null },
          },
        ],
        next: {
          systemId: 'd',
          kind: 'dehumidifier',
          messageKind: 'generic',
          displayName: 'Deumidificatore',
          at: '2026-11-20T10:00:00+01:00',
          change: 'on',
          targetC: null,
        },
      },
      TZ,
    );
    expect(text.rest).toBe(
      'Caloriferi: in standby, target 20,0°. Deumidificatore: deumidifica. Il climatizzatore raffredda verso —°. Alle 10:00 Deumidificatore si accende.',
    );
  });
});
