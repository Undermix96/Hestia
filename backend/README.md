# Hestia backend

Python 3.12 + FastAPI service that talks to Home Assistant and exposes the Hestia API under `/api`.
Dependencies are managed with [uv](https://docs.astral.sh/uv/).

## Layout

| Package | Role |
|---|---|
| `hestia/core` | Pure domain logic. No I/O, no frameworks (enforced by import-linter). |
| `hestia/ports` | Interfaces between the core and the outside world; may depend only on the core. |
| `hestia/adapters` | Implementations of the ports (Home Assistant, InfluxDB, weather, ...). |
| `hestia/app` | Application services wiring core and adapters together. |
| `hestia/api` | FastAPI routers, mounted under `/api`. |
| `hestia/testing` | Test kit for adapters (fakes, fixtures, contract test classes). |
| `hestia/main.py` | ASGI app (`hestia.main:app`, built by `create_app()`). |
| `tests/` | pytest suite. |

## Development

All commands run from `backend/`:

```sh
uv sync                                   # create .venv with dev tools
uv run uvicorn hestia.main:app --reload   # http://127.0.0.1:8000/api/docs
```

Checks run by CI (run them before opening a PR):

```sh
uv sync --locked
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run lint-imports
uv run pytest
uv run python -m hestia.export_openapi --check
```

## API contract

`contract/openapi.json` (at the repository root) is generated from the Pydantic models and committed.
After changing an endpoint or a model, regenerate it and commit the result:

```sh
uv run python -m hestia.export_openapi
```

CI fails when the committed file is out of date. API payloads use camelCase on the wire
(`hestia.api.schemas.ApiModel`) and snake_case in Python.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `HESTIA_VERSION` | `0.0.0-dev` | Reported by `GET /api/version`; set by the image build (`--build-arg VERSION=...`). |

## Docker image

The build context is the repository root:

```sh
docker build -f backend/Dockerfile --build-arg VERSION=0.1.0 -t hestia-backend:dev .
docker run --rm -p 8000:8000 hestia-backend:dev
```

The container runs as a non-root user, listens on `0.0.0.0:8000`, keeps its state in `/data`
and has a Docker `HEALTHCHECK` on `/api/health`.
