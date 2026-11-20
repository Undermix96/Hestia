import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VersionStatus } from '../src/app/VersionStatus';
import { t } from '../src/i18n';

function mockFetch(response: Response | Error) {
  const fn = vi.fn<typeof fetch>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('VersionStatus', () => {
  it('shows a loading message first', () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => new Promise<Response>(() => {})));
    render(<VersionStatus />);
    expect(screen.getByRole('status')).toHaveTextContent(t('status.loading'));
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'loading');
  });

  it('shows the backend version when /api/version answers', async () => {
    const fetchMock = mockFetch(jsonResponse({ version: '1.2.3', apiVersion: 1 }));
    render(<VersionStatus />);

    expect(await screen.findByText(t('status.ok', { version: '1.2.3' }))).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'ok');
    expect(fetchMock).toHaveBeenCalledWith('/api/version', expect.anything());
  });

  it('shows an error when the backend answers with an HTTP error', async () => {
    mockFetch(jsonResponse({ detail: 'boom' }, 502));
    render(<VersionStatus />);

    expect(await screen.findByText(t('status.error'))).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'error');
  });

  it('shows an error when the payload is malformed', async () => {
    mockFetch(jsonResponse({ unexpected: true }));
    render(<VersionStatus />);

    expect(await screen.findByText(t('status.error'))).toBeInTheDocument();
  });

  it('shows an error when the network fails', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    render(<VersionStatus />);

    expect(await screen.findByText(t('status.error'))).toBeInTheDocument();
  });
});
