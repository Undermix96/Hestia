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
| `npm run e2e`       | Playwright (Chromium) against `vite preview` on the mock data.  |
| `npm run gen:api`   | Regenerate `src/api/schema.d.ts` from `../contract/openapi.json` (never edit it by hand). |
| `npm run check:api` | Fail if `src/api/schema.d.ts` is out of date with the contract (CI runs it). |

CI runs `npm ci`, `check:api`, `lint`, `typecheck`, `test` and `build`, and in a
separate job `e2e` inside the Playwright Docker image (see [End-to-end tests](#end-to-end-tests)).

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

## End-to-end tests

Playwright drives the production build (`vite preview` on port 4173, started by
`playwright.config.ts`) on the mock data source; no backend is needed. Every
page runs at 1400×1000 px, `it-IT`, time zone `Europe/Rome`, with `Date` frozen
at the mock clock (20 Nov 2026, 08:30) and `prefers-reduced-motion: reduce`.

| Spec | What it checks |
| --- | --- |
| `e2e/smoke.spec.ts` | App shell, header links, `?scenario` kept by links, unknown scenario, `?source=http` error view |
| `e2e/stanza.spec.ts` | `home` Stanza: texts and numbers in 24 ore / 7 giorni, cursor (pointer and keyboard), slot editor |
| `e2e/tutte.spec.ts` | `home` Tutte le stanze: values per room, cursor, "apri la stanza" |
| `e2e/scenarios.spec.ts` | Smoke of every scenario (`perSlot`, `readonly`, `noProgram`, `manyRooms`) |
| `e2e/a11y.spec.ts` | axe-core, WCAG 2.0/2.1 A and AA, on every `home` room (24 ore and 7 giorni), the slot editor and Tutte le stanze |

`e2e/fixtures.ts` holds the shared `test`: it fails any test whose page logs a
`console.error` or an uncaught error (a spec that expects one lists it with
`test.use({ allowedConsoleErrors: [/…/] })`), and the helpers to open a screen
and wait until its data and fonts are loaded.

```sh
npx playwright install chromium     # once
npm run e2e                         # whole suite
npx playwright test stanza          # one spec
npx playwright test --ui            # interactive
```

### Screenshots

The tests tagged `@visual` (in `stanza.spec.ts` and `tutte.spec.ts`) compare
five whole-page screenshots of the `home` scenario with the baselines in
`e2e/__screenshots__/<spec>/` (`stanza-24h`, `stanza-7d`, `stanza-cursor`,
`tutte-24h`, `tutte-7d`; tolerance: 1 % of the pixels, colour threshold 0.2).

The baselines are **Linux renders made in the official Playwright Docker
image**, the same image the CI `e2e` job runs in, so text rasterisation matches.
On Windows and macOS the `@visual` tests are skipped; everything else runs.

To create or update the baselines, run from `frontend/` (any OS with Docker;
the image tag must equal the installed `@playwright/test` version, see
`package-lock.json`, and the CI job's `container.image` in
`.github/workflows/tests.yml`):

```sh
# PowerShell: one line, without the trailing backslashes. Git Bash on Windows: prefix with MSYS_NO_PATHCONV=1.
docker run --rm --ipc=host -v "$PWD/..:/work" -v /work/frontend/node_modules -w /work/frontend \
  mcr.microsoft.com/playwright:v1.65.1-noble \
  sh -c "npm ci && npx playwright test --grep @visual --update-snapshots"
```

The repository is mounted at `/work`; the second `-v` gives the container its own
`node_modules`, so your local one is left alone. Drop `--grep @visual
--update-snapshots` to run the whole suite on Linux exactly as CI does.

Before committing new baselines, open them and compare with
`docs/design/screenshots/`. Expected differences: "Hestia" instead of "casa",
no Energia/Luci/+ modulo (D13), clock 08:30 instead of 08:37 (D14), no mode
buttons in the power card (D9), weekend rows starting at 06:00 (D7), 1400 px
instead of 1440 px, and complete lines where the mockup screenshots caught the
reveal animation half way.

When you upgrade `@playwright/test`, change the image tag in the command above
and in `tests.yml`, then regenerate the baselines.

## Layout

```text
frontend/
├─ src/
│  ├─ app/          App shell: router, layout, header, module registry, error views
│  ├─ api/          Generated contract types (schema.d.ts), data sources (mock, http)
│  ├─ i18n/         t() (ICU MessageFormat) and Intl number/date helpers (format.ts)
│  ├─ lib/          Small framework-free helpers (time zones, program coverage)
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
- **E2E tests never need a real backend.** They run on the mock data source;
  a test that needs `/api/*` mocks it with `page.route`.
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
