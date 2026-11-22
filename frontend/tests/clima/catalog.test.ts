// The message catalog (locales/it.json) against the code that uses it:
// - every key the sources name (string literals, template-literal key patterns) exists;
// - every key built at runtime (kinds, summary facts, actions, modes, error codes, mock fixture names) exists;
// - no message is unused, except the documented allowlist below;
// - the design tokens in tokens.css and the JS palette (logic/colors.ts) agree.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import catalog from '../../../locales/it.json';
import { MockDataSource } from '../../src/api/datasource';
import { SCENARIO_IDS, type DataSourceErrorCode } from '../../src/api/datasource/types';
import type { Action, Mode, TimeRange, Weekday } from '../../src/api/types';
import { IDLE_PATTERN, PALETTE } from '../../src/modules/clima/logic/colors';
import type { SummaryFacts } from '../../src/modules/clima/logic/summaryFacts';
import type { EditorOption } from '../../src/modules/clima/types';
import type { MessageKind } from '../../src/modules/clima/systemKinds/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../../src');
const TOKENS = path.resolve(SRC, 'styles/tokens.css');

const keys = Object.keys(catalog).filter((k) => k !== 'meta');
const keySet = new Set(keys);
const namespaces = new Set(keys.map((k) => k.split('.')[0]!));

/**
 * Messages no source names on its own and no runtime path below builds. Each entry says why it stays.
 * Keep this list short: a key that is really unused should be deleted from locales/it.json instead.
 */
const UNUSED_ALLOWLIST: Record<string, string> = {};

// Every value of the closed unions the UI turns into keys. `satisfies Record<…>` makes TypeScript fail
// when a member is added to the contract and not listed here.
const ACTIONS = Object.keys({ heat: 1, cool: 1, dry: 1, idle: 1, off: 1 } satisfies Record<Action, 1>);
const MODES = Object.keys({
  heat: 1,
  cool: 1,
  heat_cool: 1,
  auto: 1,
  dry: 1,
  fan_only: 1,
  off: 1,
} satisfies Record<Mode, 1>);
const ERROR_CODES = Object.keys({
  no_data_source: 1,
  not_found: 1,
  invalid_change: 1,
  network: 1,
  unexpected: 1,
} satisfies Record<DataSourceErrorCode, 1>);
const WEEKDAYS = Object.keys({ mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 1, sun: 1 } satisfies Record<Weekday, 1>);
const RANGES = Object.keys({ '24h': 1, '7d': 1 } satisfies Record<TimeRange, 1>);
const EDITOR_OPTIONS = Object.keys({
  slot: 1,
  permanentValue: 1,
  permanentTimes: 1,
} satisfies Record<EditorOption, 1>);
const MESSAGE_KINDS = Object.keys({ radiator: 1, ac: 1, generic: 1 } satisfies Record<MessageKind, 1>);
type SystemStateType = SummaryFacts['systems'][number]['state']['type'];
const SUMMARY_TYPES = Object.keys({
  heatingTowards: 1,
  coolingTowards: 1,
  drying: 1,
  aboveTarget: 1,
  inRange: 1,
  standby: 1,
  notScheduled: 1,
  off: 1,
  unknown: 1,
} satisfies Record<SystemStateType, 1>);
type NextChange = NonNullable<SummaryFacts['next']>['change'];
const NEXT_CHANGES = Object.keys({ target: 1, on: 1, off: 1 } satisfies Record<NextChange, 1>);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

const sources = sourceFiles(SRC).map((file) => ({
  file: path.relative(SRC, file).replaceAll('\\', '/'),
  text: readFileSync(file, 'utf8'),
}));

/** Quoted literals shaped like a catalog key of a known namespace ('clima.range.label'). */
function staticKeys(): Map<string, string> {
  const found = new Map<string, string>();
  const literal = /(['"])([a-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)\1/g;
  for (const { file, text } of sources) {
    for (const m of text.matchAll(literal)) {
      const key = m[2]!;
      if (namespaces.has(key.split('.')[0]!) && !found.has(key)) found.set(key, file);
    }
  }
  return found;
}

/** Template literals that build keys (`kind.${kind}.name`), as regular expressions over the catalog. */
function templatePatterns(): { source: string; file: string; re: RegExp }[] {
  const out: { source: string; file: string; re: RegExp }[] = [];
  const template = /`([a-z][A-Za-z0-9_]*\.(?:[A-Za-z0-9_.]|\$\{[^}]+\})+)`/g;
  for (const { file, text } of sources) {
    for (const m of text.matchAll(template)) {
      const source = m[1]!;
      if (!source.includes('${') || !namespaces.has(source.split('.')[0]!)) continue;
      const parts = source.split(/\$\{[^}]+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      out.push({ source, file, re: new RegExp(`^${parts.join('[^.]+')}$`) });
    }
  }
  return out;
}

/** Every `nameKey`/`labelKey` in the mock data of every scenario and range. */
async function mockFixtureKeys(): Promise<Set<string>> {
  const found = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === 'object') {
      for (const [prop, v] of Object.entries(value)) {
        if ((prop === 'nameKey' || prop === 'labelKey') && typeof v === 'string') found.add(v);
        else walk(v);
      }
    }
  };
  for (const scenario of SCENARIO_IDS) {
    const ds = new MockDataSource(scenario);
    const rooms = await ds.getRooms();
    walk(rooms);
    for (const range of RANGES as TimeRange[]) {
      walk(await ds.getOverview({ range }));
      for (const room of rooms) walk(await ds.getRoomTimeline({ roomId: room.id, range, draft: null }));
    }
  }
  return found;
}

/** Keys the code builds at runtime from closed unions (names.ts, systemKinds, summaryText, PowerCard, …). */
function builtKeys(): string[] {
  return [
    ...ACTIONS.map((a) => `action.${a}`),
    'action.unknown',
    ...MODES.map((m) => `mode.${m}`),
    ...ERROR_CODES.map((c) => `error.${c}`),
    ...WEEKDAYS.map((d) => `common.weekday.${d}`),
    ...RANGES.flatMap((r) => [`clima.range.${r}`, `clima.range.description.${r}`]),
    ...EDITOR_OPTIONS.map((o) => `clima.editor.scope.${o}`),
    ...['name', 'short', 'lower', 'target', 'modeLabel'].map((f) => `kind.generic.${f}`),
    ...['radiator', 'ac'].flatMap((k) => ['name', 'short', 'lower', 'target'].map((f) => `kind.${k}.${f}`)),
    ...SUMMARY_TYPES.map((s) => `clima.summary.system.${s}.generic`),
    ...NEXT_CHANGES.map((c) => `clima.summary.next.${c}.generic`),
    'clima.power.unmeasured.generic',
  ];
}

describe('message catalog vs. sources', () => {
  it('every key literal in src exists', () => {
    expect(staticKeys().size).toBeGreaterThan(100);
    const missing = [...staticKeys()].filter(([key]) => !keySet.has(key)).map(([key, file]) => `${key} (${file})`);
    expect(missing).toEqual([]);
  });

  it('every template-literal key pattern in src matches at least one message', () => {
    const patterns = templatePatterns();
    expect(patterns.length).toBeGreaterThan(5);
    const dead = patterns.filter((p) => !keys.some((k) => p.re.test(k))).map((p) => `${p.source} (${p.file})`);
    expect(dead).toEqual([]);
  });

  it('every key built from the contract unions exists (with the generic fallbacks)', () => {
    expect(builtKeys().filter((k) => !keySet.has(k))).toEqual([]);
  });

  it('every summary message kind is a known kind spec', () => {
    const summaryKeys = keys.filter((k) => k.startsWith('clima.summary.system.') || k.startsWith('clima.summary.next.'));
    const kinds = new Set(summaryKeys.map((k) => k.split('.').at(-1)!));
    expect([...kinds].filter((k) => !MESSAGE_KINDS.includes(k))).toEqual([]);
  });

  it('every name and level key of the mock scenarios exists', async () => {
    const used = await mockFixtureKeys();
    expect(used.size).toBeGreaterThan(10);
    expect([...used].filter((k) => !keySet.has(k))).toEqual([]);
  });

  it('has no unused message outside the allowlist', async () => {
    const fixtures = await mockFixtureKeys();
    // names.ts also looks up the optional short and lowercase forms of a fixture name (`<nameKey>.short`).
    const forms = [...fixtures].flatMap((k) => [`${k}.short`, `${k}.lower`]);
    const used = new Set([...staticKeys().keys(), ...builtKeys(), ...fixtures, ...forms]);
    const patterns = templatePatterns();
    const unused = keys.filter((k) => !used.has(k) && !patterns.some((p) => p.re.test(k)) && !(k in UNUSED_ALLOWLIST));
    expect(unused).toEqual([]);
    // An allowlisted key must still exist and still be unused, or it should leave the list.
    for (const key of Object.keys(UNUSED_ALLOWLIST)) {
      expect(keySet.has(key), key).toBe(true);
      expect(used.has(key), key).toBe(false);
    }
  });
});

describe('design tokens vs. the JS palette', () => {
  const css = readFileSync(TOKENS, 'utf8');
  const token = (name: string): string | undefined =>
    new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();

  it('every PALETTE colour equals its --c-* token', () => {
    const toToken = (name: string) => `c-${name.replace(/([A-Z0-9])/g, '-$1').toLowerCase()}`;
    const mismatches: string[] = [];
    for (const [name, value] of Object.entries(PALETTE)) {
      if (name === 'idleA' || name === 'idleB') continue; // only inside the idle pattern (next test)
      const css = token(toToken(name));
      if (css?.toUpperCase() !== value.toUpperCase()) mismatches.push(`${name}: ${value} vs --${toToken(name)}: ${css}`);
    }
    expect(mismatches).toEqual([]);
  });

  it('the idle pattern is the same in CSS and JS', () => {
    expect(token('pattern-idle')).toBe(IDLE_PATTERN);
    expect(IDLE_PATTERN).toContain(PALETTE.idleA);
    expect(IDLE_PATTERN).toContain(PALETTE.idleB);
  });
});
