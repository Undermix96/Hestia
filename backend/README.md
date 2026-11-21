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
(`hestia.api.schemas.ApiModel`) and snake_case in Python. After regenerating the contract, also
regenerate the frontend types (`npm run gen:api` from `frontend/`).

Where the contract models live:

| Module | Contents |
|---|---|
| `hestia/core/base.py` | `DomainModel`: camelCase aliases, frozen; every property is listed as required in the JSON schema (nullable fields are sent as `null`, never omitted). |
| `hestia/core/{literals,program,capabilities,overrides}.py` | Domain values on the wire: programs (`Program`, `Slot`, `Level`), adapter capabilities, overrides. |
| `hestia/core/domain.py` | Configuration entities (`Room`, `System`, `AdapterRef`): internal, not exported in M1. |
| `hestia/api/schemas.py` | `ApiModel` (subclass of `DomainModel`) and the `ApiError` body (`code`, `message`). |
| `hestia/api/clima_models.py` | UI aggregates of the clima module (`RoomTimeline`, `ClimaOverview`, ...). |

The clima and override endpoints (`GET /api/rooms`, `GET /api/clima/rooms/{room_id}/timeline`,
`GET /api/clima/overview`, `POST /api/overrides`, `DELETE /api/overrides/{override_id}`) have their
final signatures but no data source yet: until M2 they answer **503** with
`{"code": "no_data_source", "message": ...}`. The M1 UI uses its own mock data source.

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
