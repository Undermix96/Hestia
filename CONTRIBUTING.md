# Contributing to Hestia

Thanks for your interest in Hestia! Contributions of any size are welcome:
bug reports, translations, adapters for other Home Assistant setups, docs and code.

Hestia is in **pre-alpha**: things change quickly. For anything bigger than a small
fix, please open an issue first so we can agree on the approach.

## Ground rules

- Code, comments, commit messages and contributor docs are in **English**.
  User-facing docs (README) exist in English and Italian; keep both in sync.
- No user-visible text hard-coded in the code: add a message to
  [`locales/it.json`](locales/README.md) and read it with `t()` (frontend `src/i18n/`).
- Keep the core pure: `backend/hestia/core` must not depend on adapters, the web
  framework or any I/O library. `import-linter` enforces this.
- Never assume a specific Home Assistant setup in the core or the UI: express
  differences as adapter capabilities. See [docs/architecture.md](docs/architecture.md).
- By contributing you agree that your work is released under the [MIT License](LICENSE).

## Repository layout

| Path | Contents |
|---|---|
| `backend/` | Python 3.12 + FastAPI (uv). Package `hestia` with `core`, `ports`, `adapters`, `app`, `api`, `testing`. |
| `frontend/` | React + TypeScript + Vite (npm), served by nginx in production. |
| `contract/openapi.json` | API contract, generated from the backend models. Do not edit by hand. |
| `locales/` | Translations ([guide for translators](locales/README.md)). |
| `examples/home-assistant/` | Home Assistant blueprints and example configurations. |
| `docs/` | Architecture, design handoff and implementation plan. |

## Development setup

Prerequisites: Python 3.12+, [uv](https://docs.astral.sh/uv/), Node.js 24 with npm,
and Docker (optional, to build the images).

Detailed commands are in [backend/README.md](backend/README.md) and
[frontend/README.md](frontend/README.md). Before opening a pull request, run the
same checks as CI:

```bash
# backend/
uv sync --locked
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run lint-imports
uv run pytest
uv run python -m hestia.export_openapi --check

# frontend/
npm ci
npm run check:api
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright install chromium   # once
npm run e2e
```

If you change the API (an endpoint or a backend model), regenerate the contract with
`uv run python -m hestia.export_openapi` (from `backend/`), then the frontend types with
`npm run gen:api` (from `frontend/`), and commit `contract/openapi.json` and
`frontend/src/api/schema.d.ts` together with your change. Never edit either file by hand.

To try the images locally (build context is the repository root):

```bash
docker build -f backend/Dockerfile -t hestia-backend:dev .
docker build -f frontend/Dockerfile -t hestia-frontend:dev .
```

## Pull requests

- Branch from `main` and keep each pull request focused on one change.
- Add or update tests for what you change; CI ([ci.yml](.github/workflows/ci.yml))
  must be green.
- Update the docs (and both READMEs, if user-facing) when behaviour changes.
- Write commit messages in the imperative mood, e.g. `Backend: add /api/version`.

## Translations

See [locales/README.md](locales/README.md) for the file format and how to add a language.

## Releases

Releases are made by the maintainer with the manual
[Docker Build](.github/workflows/docker-build.yml) workflow; see
[README.md](README.md#versioning-and-releases).
