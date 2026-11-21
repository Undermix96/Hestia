// Data source selection (?source, ?scenario) and the HTTP data source error mapping.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDataSource, HttpDataSource, MockDataSource, parseDataSourceParams } from '../../src/api/datasource';
import { DataSourceError } from '../../src/api/datasource/types';
import type { OverrideCreate } from '../../src/api/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseDataSourceParams', () => {
  it('defaults to the mock home scenario', () => {
    expect(parseDataSourceParams('')).toEqual({ source: 'mock', scenario: 'home', warnings: [] });
  });
  it('reads source and scenario', () => {
    expect(parseDataSourceParams('?scenario=manyRooms')).toMatchObject({ source: 'mock', scenario: 'manyRooms' });
    expect(parseDataSourceParams('?source=http')).toMatchObject({ source: 'http', warnings: [] });
    expect(parseDataSourceParams('?source=mock', 'http').source).toBe('mock');
  });
  it('uses the env default and warns on unknown values', () => {
    expect(parseDataSourceParams('', 'http').source).toBe('http');
    expect(parseDataSourceParams('', 'bogus').source).toBe('mock');
    const p = parseDataSourceParams('?scenario=bogus&source=ftp');
    expect(p.scenario).toBe('home');
    expect(p.source).toBe('mock');
    expect(p.warnings).toHaveLength(2);
  });
});

describe('createDataSource', () => {
  it('builds the mock with the requested scenario', () => {
    const ds = createDataSource('?scenario=perSlot');
    expect(ds).toBeInstanceOf(MockDataSource);
    expect(ds.scenario).toBe('perSlot');
  });
  it('logs a warning for an unknown scenario', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(createDataSource('?scenario=bogus').scenario).toBe('home');
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('builds the http source', () => {
    const ds = createDataSource('?source=http');
    expect(ds).toBeInstanceOf(HttpDataSource);
    expect(ds.kind).toBe('http');
    expect(ds.scenario).toBeNull();
  });
});

function respond(status: number, body: unknown) {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HttpDataSource', () => {
  const draft: OverrideCreate = {
    systemId: 'z',
    slotRef: 'fri-1',
    day: 'fri',
    scope: 'slot',
    change: { deltaC: null, targetC: 22, levelValueC: null, from: null, to: null, days: null },
    validUntil: null,
  };

  it('requests the contract paths with Accept: application/json', async () => {
    const fetchMock = vi.fn(async () => respond(200, []));
    vi.stubGlobal('fetch', fetchMock);
    const ds = new HttpDataSource();
    const signal = new AbortController().signal;
    await ds.getRooms(signal);
    await ds.getRoomTimeline({ roomId: 'a b', range: '7d', draft }, signal);
    await ds.getOverview({ range: '24h' });
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map((c) => c[0])).toEqual([
      '/api/rooms',
      '/api/clima/rooms/a%20b/timeline?range=7d',
      '/api/clima/overview?range=24h',
    ]);
    expect(calls[0]![1].headers).toMatchObject({ Accept: 'application/json' });
    expect(calls[0]![1].signal).toBe(signal);
  });

  it.each([
    [503, { code: 'no_data_source', message: 'later' }, 'no_data_source'],
    [404, { code: 'not_found', message: 'x' }, 'not_found'],
    [409, { code: 'stale_program', message: 'x' }, 'invalid_change'],
    [422, { detail: [] }, 'invalid_change'],
    [500, null, 'unexpected'],
  ])('maps HTTP %s to %s', async (status, body, code) => {
    vi.stubGlobal('fetch', vi.fn(async () => respond(status, body)));
    const p = new HttpDataSource().getRooms();
    await expect(p).rejects.toBeInstanceOf(DataSourceError);
    await expect(p).rejects.toMatchObject({ code, status });
  });

  it('network failures and aborts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    await expect(new HttpDataSource().getRooms()).rejects.toMatchObject({ code: 'network' });
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new DOMException('Aborted', 'AbortError'))));
    await expect(new HttpDataSource().getRooms()).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('notifies subscribers after a successful write only', async () => {
    const ds = new HttpDataSource();
    const listener = vi.fn();
    ds.subscribe(listener);
    vi.stubGlobal('fetch', vi.fn(async () => respond(201, { id: 'o1' })));
    await ds.createOverride(draft);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    await ds.deleteOverride('o1');
    expect(listener).toHaveBeenCalledTimes(2);
    vi.stubGlobal('fetch', vi.fn(async () => respond(503, { code: 'no_data_source', message: 'x' })));
    await expect(ds.createOverride(draft)).rejects.toMatchObject({ code: 'no_data_source' });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
