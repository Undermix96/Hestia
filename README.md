# Hestia

[Italiano](README.it.md) · **English**

Hestia is a web dashboard for [Home Assistant](https://www.home-assistant.io/)
that runs in Docker on your LAN. Its first module, **Climate**, shows each room's
temperature, heating and cooling systems, schedules and power usage, with a
"Room" view and an "All rooms" view. The menu is modular, so more features can
be added over time.

Hestia is designed to adapt to very different Home Assistant setups: everything
that talks to HA, InfluxDB or weather services is an **adapter** with its own
configuration schema and declared capabilities, and the UI adapts to what each
adapter supports. See [docs/architecture.md](docs/architecture.md).

## Status

**Pre-alpha — M1 released as `v0.2.0`** (M0, the skeleton, was
released as `v0.1.0`). The Climate module's "Room" and "All rooms" screens are
finished, but they run on **simulated data** (a fixed clock and a few mock
houses, selectable with `?scenario=`): Hestia does not read Home Assistant yet,
so there is still nothing useful to install. Real data arrives in M2; design
notes per milestone are in [docs/implementation-plan.md](docs/implementation-plan.md) §5.

## Quick start

Requirements: Docker with the Compose plugin, on `amd64` or `arm64`.

```bash
mkdir hestia && cd hestia
curl -fsSLO https://raw.githubusercontent.com/Undermix96/Hestia/main/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/Undermix96/Hestia/main/.env.example -o .env  # optional
docker compose up -d
```

Then open `http://<host>:8080`.

- The `.env` file is optional; see [`.env.example`](.env.example) for the
  available variables (`HESTIA_TAG` to pin an image tag, `HESTIA_PORT` to
  change the published port, and the Home Assistant / InfluxDB settings used by
  later milestones).
- Data (configuration, database, extra languages, plugins) is stored in the
  `hestia-data` volume, mounted at `/data` in the backend.
- Only the frontend publishes a port; the backend is reached through it at `/api/`.
- Hestia has no login and is meant for the LAN only. If you expose it, put it
  behind a reverse proxy with authentication.

To update: `docker compose pull && docker compose up -d`.

## Images and tags

| Image | Contents |
|---|---|
| `ghcr.io/undermix96/hestia-backend` | Python/FastAPI API on port 8000 (non-root) |
| `ghcr.io/undermix96/hestia-frontend` | Static UI served by unprivileged nginx on port 8080, proxying `/api/` to the backend (`BACKEND_URL`, default `http://backend:8000`) |

Both images are multi-arch (`linux/amd64`, `linux/arm64`) and public: no login is
needed to pull them. Each release publishes the tags `vX.Y.Z`, `X.Y.Z`, `X.Y`,
`sha-<commit>` and `latest`. Always use the same tag for both images.

## Versioning and releases

Versions follow `vMAJOR.MINOR.PATCH`; each version is a git tag plus the two images.

Releases are made by the [`Docker Build`](.github/workflows/docker-build.yml)
workflow, started manually from the GitHub **Actions** tab (**Run workflow**),
only from `main`.

| Input | Default | Description |
|---|---|---|
| `bump` | `patch` | Part to increment from the latest tag (`patch`, `minor`, `major`). Without previous tags it starts from `v0.0.1`. |
| `version` | empty | Explicit version (e.g. `v0.1.0`); when set, `bump` is ignored. |

Each run:

1. computes the version and stops if the tag already exists;
2. runs the full test suite (the same as [CI](.github/workflows/ci.yml));
3. builds and pushes both images for `amd64` and `arm64` with the immutable
   tags (`vX.Y.Z`, `X.Y.Z`, `sha-<commit>`);
4. moves `X.Y` and `latest` of both images to the new release, only after both
   builds succeeded, so the shared tags always match across the two images;
5. creates and pushes the git tag `vX.Y.Z`, only after both builds succeeded;
   the tag is pushed with the `RELEASE_TOKEN` secret (see below);
6. checks that both images can be pulled anonymously for both architectures.

> **`RELEASE_TOKEN`:** GitHub refuses to let the default `GITHUB_TOKEN` push a tag
> onto a commit that changes `.github/workflows/`, so the tag is pushed with a
> fine-grained token saved as the repository secret `RELEASE_TOKEN`, with
> *Contents* and *Workflows* write access on this repository only. The workflow
> stops before building anything if the secret is missing. The token expires:
> renew it and update the secret when it does.

> **Visibility:** the packages are linked to this public repository and inherit its
> visibility, so they are public from the first publish. If a package ever ends up
> private (e.g. in a fork), the last step fails with a link to change it.

## Development

This is a monorepo:

| Path | Contents |
|---|---|
| [`backend/`](backend/README.md) | Python 3.12 + FastAPI, managed with uv |
| [`frontend/`](frontend/README.md) | React + TypeScript + Vite, managed with npm |
| [`contract/openapi.json`](contract/openapi.json) | API contract generated from the backend |
| [`locales/`](locales/README.md) | Translations |
| [`docs/`](docs/) | Architecture, design, specs and implementation plan |

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md)
for the commands to install, run, lint and test each part, and
[CONTRIBUTING.md](CONTRIBUTING.md) for the contribution guidelines.

## Documentation

- [docs/architecture.md](docs/architecture.md): architecture overview (core, ports, adapters).
- [docs/implementation-plan.md](docs/implementation-plan.md): project design and notes per milestone (in Italian).
- [DECISIONS.md](DECISIONS.md): durable decisions.
- [docs/specs/m1-ui.md](docs/specs/m1-ui.md): historical implementation spec of M1.
- [docs/design/](docs/design/README.md): design specification of the Climate
  dashboard; start from [HANDOFF.md](docs/design/HANDOFF.md).

## License

[MIT](LICENSE) © 2026 Undermix96
