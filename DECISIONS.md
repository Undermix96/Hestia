# Decisions

Durable decisions of Hestia (the "why"). Work state (roadmap, tasks, diary, open questions) lives in
Heph; the project design lives in [`docs/implementation-plan.md`](docs/implementation-plan.md).

D1–D14 come from the M1 spec ([`docs/specs/m1-ui.md`](docs/specs/m1-ui.md)) and keep its numbers,
because code comments cite them. D15 onwards were imported from the implementation plan afterwards,
so some of them carry an earlier date. "Not recorded" means the source gave no value.

## D1 — Fixed mock clock (2026-11-21)
Decision: the mock clock is `2026-11-20T08:30:00+01:00`, time zone `Europe/Rome`. Every "now" in the mock comes from this constant, never from `Date.now()`.
Why: not recorded.
Alternatives rejected: not recorded.

## D2 — Contract-first models (2026-11-21)
Decision: domain value models live in `backend/hestia/core/` as Pydantic models; UI aggregates live in `backend/hestia/api/clima_models.py` (`ApiModel`, a subclass of the core `DomainModel`, same camelCase config).
Why: Pydantic is allowed in the pure core because it does no I/O.
Alternatives rejected: not recorded.

## D3 — Real contract routes that answer 503 (2026-11-21)
Decision: the M1 routes (`GET /api/rooms`, `GET /api/clima/rooms/{room_id}/timeline`, `GET /api/clima/overview`, `POST /api/overrides`, `DELETE /api/overrides/{override_id}`) are registered with their final models; until a data source exists they answer 503 `{"code": "no_data_source", "message": ...}`.
Why: the routes and schemas are the M2 contract, FastAPI exports them naturally, and nothing pretends to serve data.
Alternatives rejected: an "extra components" hack to put the models into the OpenAPI document.

## D4 — Generated TypeScript types (2026-11-21)
Decision: TS types are generated with `openapi-typescript` 7.13.0 into `frontend/src/api/schema.d.ts` (committed, never edited). `npm run gen:api` writes, `npm run check:api` fails on drift and runs in CI. Friendly aliases live in `frontend/src/api/types.ts`.
Why: not recorded.
Alternatives rejected: not recorded.

## D5 — No clock time derived from sample indices (2026-11-21)
Decision: every grid sample has its ISO timestamp with offset in `grid.t[i]`; segment and run boundaries carry indices and timestamps; hours and day labels come from `Intl.DateTimeFormat` with `clock.timeZone`.
Why: not recorded.
Alternatives rejected: deriving the time from the sample index, as the mockup's `hAt()` does.

## D6 — Data source selection (2026-11-21)
Decision: M1 uses `MockDataSource` unless the URL has `?source=http`; the scenario comes from `?scenario=home|perSlot|readonly|noProgram|manyRooms` (default `home`), read once at boot.
Why: `?source=http` is a development aid for M2 and shows the 503 error state.
Alternatives rejected: not recorded.

## D7 — Program representation of the `home` scenario (2026-11-21)
Decision: radiators and splits use `representation: 'levels'`, like `ha_schedule_levels`, with one level per distinct target value of the mockup (soggiorno 2 levels, camera 4, cameretta 4, bagno 3; each split 1 level, its set point), and the same weekday program on all 7 days. The weekend variant starting at 07:30 lives in the `perSlot` scenario.
Why: it reproduces the screenshots exactly; a weekend program would change the 7-day values (checked: the bagno temperature now becomes 20.4 instead of 20.1). Accepted deviation: in `home` Saturday and Sunday start at 06:00, and the handoff says the weekend must be read from the real program.
Alternatives rejected: a weekend-specific program in `home` (changes the 7-day values).

## D8 — Per-range simulation quirk preserved (2026-11-21)
Decision: like the mockup, the 24h and 7d views run separate simulations (different warm-up start and outdoor noise alignment), so the temperature "now" differs between them (Soggiorno 21.8 in 24h, 21.5 in 7d).
Why: this is what the screenshots show.
Alternatives rejected: not recorded.

## D9 — No mode buttons (2026-11-20)
Decision: no Heat/Cool/Dry/Off buttons in the UI. The home automation system decides the mode; Hestia reads it; the PowerCard shows the mode of mode-based systems as read-only text. This overrides the design handoff.
Why: the mode is decided by the home automation system.
Alternatives rejected: mode buttons as in the handoff.

## D10 — Temporary overrides only on the current slot (2026-11-20)
Decision: temporary overrides apply only to the slot in progress. Future slots offer only the permanent changes the capabilities allow. Ended slots are not clickable.
Why: on a future slot Hestia would race the user's automation (plan R4).
Alternatives rejected: temporary overrides on future slots.

## D11 — One i18n catalog (2026-11-21)
Decision: `locales/it.json` at the repository root (flat ICU messages plus `meta`) is the single source; the frontend imports it at build time and tests import the same file. `en.json` stays `meta`-only in M1. `frontend/src/i18n/it.json` is deleted. The names of mock rooms and systems are catalog keys too (`mock.*`), and a test checks for missing and unused keys.
Why: not recorded.
Alternatives rejected: a second catalog in `frontend/src/i18n/`.

## D12 — Linux screenshot baselines (2026-11-21)
Decision: Playwright visual tests run at 1400 px, Europe/Rome, it-IT, fixed clock, reduced motion and animations disabled. Baselines are generated on Linux in the Playwright Docker image (same version as `@playwright/test`); visual tests are skipped on other hosts. In CI, Playwright runs in an `e2e` job inside the same image.
Why: not recorded.
Alternatives rejected: not recorded.

## D13 — M1 header and hidden modules (2026-11-21)
Decision: the header shows "Hestia" (not "casa"); Energia and Luci are registered but hidden; "+ modulo" is not shown in M1.
Why: not recorded.
Alternatives rejected: not recorded.

## D14 — Header time with the mock clock (2026-11-21)
Decision: the mock clock is 08:30, so the header shows `ven 20 nov · 08:30`.
Why: the 08:37 in the screenshots is a mockup literal.
Alternatives rejected: not recorded.

## D15 — The backend owns the Home Assistant connection (2026-11-20)
Decision: the backend container holds the HA token, subscribes to the HA WebSocket and exposes the contract API plus live updates over SSE.
Why: the frontend never sees the token.
Alternatives rejected: not recorded.

## D16 — Frontend stack (2026-11-20)
Decision: React + TypeScript + Vite; CSS animations, with Motion where they need coordinating; types generated from the backend's OpenAPI document.
Why: not recorded.
Alternatives rejected: not recorded.

## D17 — Backend stack (2026-11-20)
Decision: Python + FastAPI.
Why: not recorded.
Alternatives rejected: not recorded.

## D18 — Two images in one repository (2026-11-20)
Decision: monorepo with two images, `hestia-backend` and `hestia-frontend`, multi-arch amd64 + arm64.
Why: not recorded.
Alternatives rejected: not recorded.

## D19 — Deploy from published images only (2026-11-20)
Decision: `docker-compose.yml` uses only the public GHCR images (no `build:` section); builds happen only in GitHub Actions.
Why: not recorded.
Alternatives rejected: not recorded.

## D20 — LAN only, no login (2026-11-20)
Decision: access is limited to the LAN and there is no login.
Why: not recorded.
Alternatives rejected: not recorded.

## D21 — Setup wizard from adapter schemas (2026-11-20)
Decision: configuration happens in a setup wizard in the UI, with forms generated from the adapter schemas.
Why: not recorded.
Alternatives rejected: not recorded.

## D22 — Energia and Luci hidden (2026-11-20)
Decision: the Energia and Luci modules are hidden; the module registry already exists.
Why: not recorded.
Alternatives rejected: not recorded.

## D23 — Languages (2026-11-20)
Decision: Italian and English; third parties can add languages without rebuilding.
Why: not recorded.
Alternatives rejected: not recorded.

## D24 — Automated tests (2026-11-20)
Decision: automated tests in CI with pytest and Vitest, plus Playwright.
Why: not recorded.
Alternatives rejected: not recorded.

## D25 — Order of work (2026-11-20)
Decision: first the UI on simulated data, then the real backend, then the setup wizard, overrides and forecast.
Why: not recorded.
Alternatives rejected: not recorded.

## D26 — MIT license (2026-11-20)
Decision: the project is public under the MIT license.
Why: not recorded.
Alternatives rejected: not recorded.

## D27 — Languages of code and documentation (2026-11-20)
Decision: code, comments and contributor docs in English; README in English and Italian.
Why: not recorded.
Alternatives rejected: not recorded.

## D28 — Image names (2026-11-20)
Decision: `ghcr.io/undermix96/hestia-backend` and `ghcr.io/undermix96/hestia-frontend`.
Why: not recorded.
Alternatives rejected: not recorded.

## D29 — Radiators take precedence in the target band (2026-11-20)
Decision: when a room has several systems, the radiators' target is the one drawn in the thermogram's comfort band.
Why: not recorded.
Alternatives rejected: not recorded.

## D30 — Each edit chooses its duration (2026-11-20)
Decision: when changing a slot the user chooses every time between "this slot only" and "permanent". A permanent change edits the level's value and/or the slot's times.
Why: not recorded.
Alternatives rejected: not recorded.

## D31 — Forecast model (2026-11-20)
Decision: a one-node thermal model with coefficients estimated from history.
Why: not recorded.
Alternatives rejected: not recorded.

## D32 — `HESTIA_TAG` selects the image tag (2026-11-21)
Decision: the compose variable for the image tag is `HESTIA_TAG`; `HESTIA_VERSION` is set only by the image and read by `/api/version`.
Why: with one name for both, a value in `.env` would overwrite the reported version.
Alternatives rejected: `HESTIA_VERSION` as the compose variable.

## D33 — Moving tags are promoted separately (2026-11-21)
Decision: a separate `promote` job moves `latest` and `X.Y` only after both builds succeed.
Why: not recorded.
Alternatives rejected: not recorded.

## D34 — nginx sets the client address (2026-11-21)
Decision: nginx sends `X-Forwarded-For: $remote_addr`.
Why: a client cannot forge the IP the backend sees.
Alternatives rejected: not recorded.

## D35 — CI triggers (2026-11-21)
Decision: `ci.yml` runs on pull requests and on pushes to `main` only.
Why: tests do not run twice.
Alternatives rejected: not recorded.

## D36 — GHCR package visibility (2026-11-21)
Decision: GHCR packages inherit the public visibility of the repository; no manual step.
Why: not recorded.
Alternatives rejected: not recorded.

## D37 — TypeScript 6.0 for now (2026-11-21)
Decision: TypeScript stays at 6.0 until typescript-eslint supports 7. pytest ignores a single Starlette deprecation warning about `httpx` (moving to `httpx2` is still to be evaluated).
Why: typescript-eslint does not support TypeScript 7 yet.
Alternatives rejected: not recorded.

## D38 — Release tags are pushed with `RELEASE_TOKEN` (2026-11-21)
Decision: the `release` job pushes the git tag with the `RELEASE_TOKEN` secret (fine-grained, Contents and Workflows write on this repository only); the `version` job stops early if it is missing. The token expires: renew it and update the secret.
Why: GitHub refuses to let `GITHUB_TOKEN` push a tag onto a commit that changes `.github/workflows/` (plan R19).
Alternatives rejected: `GITHUB_TOKEN`, which cannot have the `workflows` permission.

## D39 — Every OpenAPI property is required (2026-11-22)
Decision: in the OpenAPI document every property is `required`; null fields travel as `null` and are never omitted.
Why: the TS types then have no optional fields.
Alternatives rejected: not recorded.

## D40 — The mock matches the mockups bit for bit (2026-11-22)
Decision: the mock reproduces the `Neng.js` simulation exactly; tests run the mockup scripts as an oracle, including the separate 24h and 7d simulations (D8).
Why: not recorded.
Alternatives rejected: not recorded.

## D41 — Scope selector in the slot editor (2026-11-22)
Decision: the editor has a scope selector ("this slot only", "permanent: value", "permanent: times"), limited to what the capabilities allow; past slots are not clickable.
Why: not recorded.
Alternatives rejected: not recorded.

## D42 — Changes apply from now on (2026-11-22)
Decision: a change splits the current slot at the present instant; the end of day is written "24:00".
Why: "00:00" would be ambiguous as an end of day.
Alternatives rejected: "00:00" as the end of day.

## D43 — Reduced motion and range changes (2026-11-22)
Decision: with `prefers-reduced-motion` animations stop and the pulse ring of status dots disappears. Switching between 24h and 7d does not animate the lines.
Why: the paths of the two ranges have different numbers of points, as in the mockup.
Alternatives rejected: not recorded.

## D44 — Contrast fixes (2026-11-22)
Decision: labels on the hottest slots (from about 22.5°) switch from white to black; in "All rooms" the standby/off text uses the text grey, not the dot grey.
Why: accessibility (axe): white on the 23° colour has a 4.1:1 contrast.
Alternatives rejected: not recorded.

## D45 — Tablet layout (2026-11-22)
Decision: between 768 and 1279 px, power and program are stacked, the side columns of "All rooms" are narrower and narrow charts show every other day label.
Why: not recorded.
Alternatives rejected: not recorded.

## D46 — Mini charts keep the mockup scale (2026-11-22)
Decision: the mini charts of "All rooms" cut the scale at 15–24°; a value outside it stays on the edge.
Why: same as the mockup.
Alternatives rejected: not recorded.

## D47 — Lazy-loaded screens (2026-11-22)
Decision: screens are loaded lazily, one chunk per screen.
Why: not recorded.
Alternatives rejected: not recorded.

## D48 — arm64 is verified by build and manifest only (2026-11-20)
Decision: arm64 images are checked through the build and the manifest, not by running them.
Why: there is no arm64 machine for tests.
Alternatives rejected: an arm64 runtime check.

## D49 — Work state moved to Heph (2026-11-27)
Decision: roadmap, tasks, next step, diary and open questions live in the Heph project `hestia`; they are no longer tracked in repository files. Before the migration they were in `docs/implementation-plan.md` at commit `69bd09f`.
Why: one place for work state; the repository keeps design and decisions.
Alternatives rejected: keeping file-based tracking (chosen in commit `6e55e23`, then reverted by the owner in `69bd09f`).
