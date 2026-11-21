// Data source selection (spec §3.1): ?source=mock|http and ?scenario=<id>, read once at boot.
import { HttpDataSource } from './http';
import { MockDataSource } from './mock/MockDataSource';
import { DEFAULT_SCENARIO, SCENARIO_IDS, type DataSource, type DataSourceKind, type ScenarioId } from './types';

export interface DataSourceParams {
  source: DataSourceKind;
  scenario: ScenarioId;
  /** developer warnings (English), logged by createDataSource */
  warnings: string[];
}

function isKind(v: string | null | undefined): v is DataSourceKind {
  return v === 'mock' || v === 'http';
}

function isScenario(v: string | null): v is ScenarioId {
  return v != null && (SCENARIO_IDS as readonly string[]).includes(v);
}

export function parseDataSourceParams(search: string, envDefault?: string): DataSourceParams {
  const params = new URLSearchParams(search);
  const warnings: string[] = [];
  const requested = params.get('source');
  let source: DataSourceKind = isKind(envDefault) ? envDefault : 'mock';
  if (isKind(requested)) source = requested;
  else if (requested != null) warnings.push(`Unknown source "${requested}", using "${source}".`);
  const scenarioParam = params.get('scenario');
  let scenario: ScenarioId = DEFAULT_SCENARIO;
  if (isScenario(scenarioParam)) scenario = scenarioParam;
  else if (scenarioParam != null) {
    warnings.push(`Unknown scenario "${scenarioParam}", using "${DEFAULT_SCENARIO}". Known: ${SCENARIO_IDS.join(', ')}.`);
  }
  return { source, scenario, warnings };
}

export function createDataSource(search: string = window.location.search): DataSource {
  const env = import.meta.env['VITE_DATA_SOURCE'] as string | undefined;
  const { source, scenario, warnings } = parseDataSourceParams(search, env);
  for (const w of warnings) console.warn(`[hestia] ${w}`);
  return source === 'http' ? new HttpDataSource() : new MockDataSource(scenario);
}

export { HttpDataSource } from './http';
export { MockDataSource } from './mock/MockDataSource';
export { MOCK_NOW_ISO, MOCK_TIME_ZONE } from './mock/clock';
