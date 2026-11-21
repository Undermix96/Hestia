// Test oracle: runs the ORIGINAL mockup code (docs/design/mockup/*.dc.html) without copying it.
// The `<script data-dc-script>` block of each mockup is evaluated with a minimal DCLogic stub.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_RE = /<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/;

function mockupScript(file: 'N-Stanza.dc.html' | 'N-Tutte.dc.html'): string {
  // (not `new URL(literal, import.meta.url)`: Vite would turn it into an asset import)
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, '../../../../docs/design/mockup', file);
  const match = SCRIPT_RE.exec(readFileSync(path, 'utf8'));
  if (!match?.[1]) throw new Error(`No data-dc-script block in ${file}`);
  return match[1];
}

class DCLogicStub {
  props: unknown;
  state: Record<string, unknown> = {};
  constructor(p: unknown) {
    this.props = p;
  }
  setState(): void {}
}

type MockRange = '24h' | '7g';

interface ComponentInstance {
  state: Record<string, unknown>;
  renderVals(): unknown;
}
type ComponentClass = new (props: unknown) => ComponentInstance;

function evaluate<T>(src: string, tail: string): T {
  const factory = new Function('DCLogic', `${src}\n;${tail}`) as (dc: typeof DCLogicStub) => T;
  return factory(DCLogicStub);
}

export interface OracleSegment {
  l: string;
  w: string;
  bg: string;
  t: string;
  cur: string;
}
export interface OracleActSegment {
  l: string;
  w: string;
  bg: string;
  op: number;
}
export interface OracleLane {
  n: string;
  prog: OracleSegment[];
  act: OracleActSegment[];
}
export interface OracleAxisLabel {
  t: string;
  l: string;
  c: string;
}
export interface OracleStanzaVals {
  g: {
    past: string;
    fut: string;
    humLine: string;
    humArea: string;
    tgt: string;
    band: string;
    oTemp: string;
    oHum: string;
    oHumArea: string;
    lanes: OracleLane[];
    xl: OracleAxisLabel[];
    nowX: string;
  };
  hero: { lead: string; rest: string; fc: string };
  energy: { now: string; day: string; eur: string };
}

export interface OracleStanza {
  render(state: { room: number; hi: number | null; range: MockRange; edits?: Record<string, number> }): OracleStanzaVals;
}

export function loadStanzaOracle(): OracleStanza {
  const Component = evaluate<ComponentClass>(mockupScript('N-Stanza.dc.html'), 'return Component;');
  return {
    render(state) {
      const c = new Component({});
      c.state = {
        room: state.room,
        hi: state.hi,
        edits: state.edits ?? {},
        sel: null,
        range: state.range,
        ac: { s: 'Caldo', c: 'Caldo' },
        tab: 0,
      };
      return c.renderVals() as OracleStanzaVals;
    },
  };
}

export interface OracleTutteRow {
  name: string;
  past: string;
  fut: string;
  tgt: string;
  band: string;
  strips: { n: string; segs: OracleActSegment[] }[];
}
export interface OracleTutteVals {
  rows: OracleTutteRow[];
  oTemp: string;
  oHum: string;
  xl: OracleAxisLabel[];
}

export function loadTutteOracle(): { render(state: { hi: number | null; range: MockRange }): OracleTutteVals } {
  const Component = evaluate<ComponentClass>(mockupScript('N-Tutte.dc.html'), 'return Component;');
  return {
    render(state) {
      const c = new Component({});
      c.state = { hi: state.hi, range: state.range, edits: {}, scene: null, ac: { s: 'Caldo', c: 'Caldo' }, tab: 1 };
      return c.renderVals() as OracleTutteVals;
    },
  };
}

export interface OracleSim {
  T: number[];
  H: number[];
  rt: (number | null)[];
  re: number[];
  ra: (string | null)[];
  as: (number | null)[];
  ae: number[];
  aa: (string | null)[];
}

export interface OracleEngine {
  setRange(r: MockRange): void;
  sim(ri: number, st: unknown): OracleSim;
  NS(): number;
  NOWI(): number;
  OUTM(): { T: number[]; H: number[] };
}

export function loadEngineOracle(): OracleEngine {
  return evaluate<OracleEngine>(
    mockupScript('N-Stanza.dc.html'),
    'return {setRange: setRange, sim: sim, ROOMS: ROOMS, NS: function(){return NS;}, NOWI: function(){return NOWI;}, OUTM: function(){return OUTM;}};',
  );
}

/** The mockup's default state for `sim()`: both splits in heat mode, no edits. */
export const ORACLE_SIM_STATE = { ac: { s: 'Caldo', c: 'Caldo' }, edits: {} };

/** Room index of the mockup → our room id. */
export const ORACLE_ROOMS = ['soggiorno', 'corridoio', 'camera', 'cameretta', 'bagno'] as const;
