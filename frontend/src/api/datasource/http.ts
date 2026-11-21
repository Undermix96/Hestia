// Data source backed by the Hestia API (spec §3.2). In M1 every data route answers 503 `no_data_source`.
import type { ApiError, ClimaOverview, Override, OverrideCreate, RoomTimeline, RoomView } from '../types';
import { DataSourceError, type DataSource, type DataSourceErrorCode, type OverviewQuery, type RoomTimelineQuery } from './types';

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

function isApiError(v: unknown): v is ApiError {
  return typeof v === 'object' && v !== null && typeof (v as ApiError).code === 'string';
}

async function errorFrom(res: Response): Promise<DataSourceError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const apiError = isApiError(body) ? body : null;
  let code: DataSourceErrorCode = 'unexpected';
  if (apiError?.code === 'no_data_source') code = 'no_data_source';
  else if (res.status === 404) code = 'not_found';
  else if (res.status === 409 || res.status === 422) code = 'invalid_change';
  const message = apiError?.message ?? `HTTP ${res.status}`;
  return new DataSourceError(code, message, res.status);
}

export class HttpDataSource implements DataSource {
  readonly kind = 'http' as const;
  readonly scenario = null;
  readonly timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone;
  private readonly listeners = new Set<() => void>();
  private readonly baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  now(): Date {
    return new Date();
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { Accept: 'application/json', ...(init.body != null ? { 'Content-Type': 'application/json' } : {}) },
      });
    } catch (e) {
      if (isAbort(e)) throw e;
      throw new DataSourceError('network', e instanceof Error ? e.message : String(e));
    }
    if (!res.ok) throw await errorFrom(res);
    return res;
  }

  private async json<T>(path: string, signal?: AbortSignal): Promise<T> {
    const res = await this.request(path, signal ? { signal } : {});
    return (await res.json()) as T;
  }

  getRooms(signal?: AbortSignal): Promise<RoomView[]> {
    return this.json<RoomView[]>('/api/rooms', signal);
  }

  getRoomTimeline(query: RoomTimelineQuery, signal?: AbortSignal): Promise<RoomTimeline> {
    return this.json<RoomTimeline>(
      `/api/clima/rooms/${encodeURIComponent(query.roomId)}/timeline?range=${query.range}`,
      signal,
    );
  }

  getOverview(query: OverviewQuery, signal?: AbortSignal): Promise<ClimaOverview> {
    return this.json<ClimaOverview>(`/api/clima/overview?range=${query.range}`, signal);
  }

  async createOverride(body: OverrideCreate): Promise<Override> {
    const res = await this.request('/api/overrides', { method: 'POST', body: JSON.stringify(body) });
    const created = (await res.json()) as Override;
    this.notify();
    return created;
  }

  async deleteOverride(overrideId: string): Promise<void> {
    await this.request(`/api/overrides/${encodeURIComponent(overrideId)}`, { method: 'DELETE' });
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const l of [...this.listeners]) l();
  }
}
