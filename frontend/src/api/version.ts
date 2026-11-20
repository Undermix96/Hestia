/** Client for `GET /api/version` (see contract/openapi.json). */

export interface VersionInfo {
  version: string;
  apiVersion: number;
}

function isVersionInfo(value: unknown): value is VersionInfo {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.version === 'string' && typeof v.apiVersion === 'number';
}

export async function fetchVersion(signal?: AbortSignal): Promise<VersionInfo> {
  const response = await fetch('/api/version', {
    headers: { Accept: 'application/json' },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    throw new Error(`GET /api/version failed with HTTP ${response.status}`);
  }
  const body: unknown = await response.json();
  if (!isVersionInfo(body)) {
    throw new Error('GET /api/version returned an unexpected payload');
  }
  return body;
}
