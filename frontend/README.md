# Hestia frontend

React + TypeScript single-page app built with Vite and served in production by
nginx (`nginxinc/nginx-unprivileged`), which also reverse-proxies `/api/` to the
backend. The browser only ever talks to nginx: no CORS, and the Home Assistant
token never reaches the frontend.

## Requirements

- Node.js 24 (the version used in CI and in the Docker build stage) and npm.
- For end-to-end tests: Playwright's Chromium (`npx playwright install chromium`;
  on Linux CI use `npx playwright install --with-deps chromium`).

## Commands

Run everything from `frontend/`:

| Command             | What it does                                                    |
| ------------------- | --------------------------------------------------------------- |
| `npm ci`            | Install the exact dependencies from `package-lock.json`.         |
| `npm run dev`       | Vite dev server; `/api` is proxied to `http://localhost:8000`.  |
| `npm run lint`      | ESLint (flat config in `eslint.config.js`).                      |
| `npm run typecheck` | `tsc --noEmit` over sources, tests and configs.                 |
| `npm run test`      | Vitest unit tests (`tests/`, jsdom).                             |
| `npm run build`     | Production build into `dist/`.                                  |
| `npm run e2e`       | Playwright (Chromium) against `vite preview`; `/api` is mocked. |

CI runs `npm ci`, `lint`, `typecheck`, `test`, `build` and `e2e`, in that order.

To develop against a backend that is not on `localhost:8000`, set
`BACKEND_URL`, e.g. `BACKEND_URL=http://192.168.1.10:8000 npm run dev`.

## Data source and scenarios

Until the backend serves data (M2), the UI runs on a simulated data source
(`src/api/datasource/mock/`) with a fixed clock (20 Nov 2026, 08:30,
Europe/Rome). Two query parameters, read once when the page loads and kept by
every in-app link and redirect, choose what you see:

| Parameter | Values | Default |
| --- | --- | --- |
| `?scenario=` | `home`, `perSlot`, `readonly`, `noProgram`, `manyRooms` | `home` |
| `?source=` | `mock`, `http` (the real backend; answers 503 in M1) | `mock` (`VITE_DATA_SOURCE`) |

For example `http://localhost:5173/clima/tutte?scenario=manyRooms`.

## Layout

```text
frontend/
├─ src/
│  ├─ app/          App shell: router, layout, header, module registry, error views
│  ├─ api/          Generated contract types (schema.d.ts), data sources (mock, http)
│  ├─ i18n/         t() (ICU MessageFormat) and Intl number/date helpers (format.ts)
│  ├─ lib/          Small framework-free helpers (time zones)
│  ├─ modules/      One folder per app module (clima; energia and luci are hidden)
│  └─ styles/       tokens.css (design tokens), global.css, motion.css/motion.ts
├─ tests/           Vitest unit tests
├─ e2e/             Playwright tests
├─ nginx/           nginx config template used by the Docker image
└─ Dockerfile       Built with the repository root as context
```

Each module (`src/modules/<id>/module.ts[x]`) registers its menu entries,
routes and header status in `src/app/modules.ts`; hidden modules are
registered but neither shown nor routed.

## Conventions

- **No hard-coded visible strings.** Every user-facing text is an ICU message in
  [`locales/it.json`](../locales/README.md) at the repository root, read with
  `t('key', { param })` from `src/i18n`. Numbers and dates are formatted with
  `fmt` (`src/i18n/format.ts`, `Intl`, always with an explicit time zone) and
  passed to messages as arguments. Tests look up expected text through `t()` or
  the JSON file rather than repeating it.
- **Use the motion classes.** Animations are the global classes of
  `src/styles/motion.css` (names in `motion.ts`); they stop under
  `prefers-reduced-motion`, and Motion components follow the same setting.
- **Use design tokens.** Colours, spacing and radii come from CSS variables in
  `src/styles/tokens.css`.
- **E2E tests never need a real backend.** Mock every `/api/*` call with
  `page.route`.
- Code, comments and docs are in English.

## Docker image

Build from the repository root:

```sh
docker build -f frontend/Dockerfile --build-arg VERSION=0.1.0 -t hestia-frontend:dev .
docker run --rm -p 8080:8080 -e BACKEND_URL=http://<backend-host>:8000 hestia-frontend:dev
```

- The Node build stage runs on the build host's platform (`--platform=$BUILDPLATFORM`),
  since the static output is the same for every architecture; only the nginx
  stage is per-architecture (amd64 and arm64).
- nginx listens on **8080** as a non-root user. Its config is rendered at
  start from `nginx/default.conf.template` with `envsubst`.
- `BACKEND_URL` (default `http://backend:8000`, no trailing slash) is resolved
  at request time through the container's DNS, so nginx starts even when the
  backend is not up yet. Because of that, use a DNS name or an IP address;
  names that exist only in `/etc/hosts` are not resolved. The address must be
  the backend as seen from inside the frontend container: the compose service
  name (`http://backend:8000`), a container name or alias on a shared
  user-defined Docker network, `http://host.docker.internal:8000` on Docker
  Desktop, or the host's LAN IP. `localhost`/`127.0.0.1` point at the frontend
  container itself, so they only work with `--network host`.
- Caching: `/assets/*` (hashed file names) is cached for a year and marked
  immutable; `index.html` is always revalidated.
- `X-Forwarded-For` is set to the client address seen by nginx (any value sent
  by the client is discarded), so nginx is the only trusted proxy hop.
- `/api/live` (Server-Sent Events) is proxied with buffering off, HTTP/1.1 and
  a one-hour read timeout.
