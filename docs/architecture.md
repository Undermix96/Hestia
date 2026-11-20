# Architecture

Hestia is a web dashboard for Home Assistant (HA) that runs on the LAN as two
containers. This page is a short overview; the full design lives in
[`implementation-plan.md`](implementation-plan.md) (written in Italian).

## Runtime

```text
browser ──HTTP──▶ frontend (nginx, :8080) ──/api/──▶ backend (FastAPI, :8000) ──WS/HTTP──▶ Home Assistant
                  static SPA                        holds the HA token            InfluxDB, weather, ...
```

- **Frontend** (`hestia-frontend`): React + TypeScript + Vite build served by
  unprivileged nginx. nginx is the only entry point: it serves the SPA and
  proxies `/api/` to the backend (with buffering disabled for the `/api/live`
  SSE stream), so no CORS is needed.
- **Backend** (`hestia-backend`): Python + FastAPI. It owns the HA token,
  subscribes to the HA WebSocket API and exposes the contract API plus live
  updates over Server-Sent Events. The browser never sees the token.
- **Contract**: the API is defined by Pydantic models; `contract/openapi.json`
  is generated from them and the TypeScript types are generated from it. CI
  fails if they drift.

## Backend layers

```text
backend/hestia/
├─ core/      pure domain logic, no I/O
├─ ports/     interfaces (Protocols/ABCs) the core talks through
├─ adapters/  implementations of the ports for HA, InfluxDB, weather, ...
├─ app/       runtime services wiring core and adapters together
├─ api/       FastAPI routers (HTTP and SSE)
└─ testing/   fakes, fixtures and reusable contract test suites
```

### Core

`hestia.core` holds the domain model and the program model, hysteresis and the
time grid, the forecast and the override state machine. It **must not** import
HA clients, InfluxDB, HTTP frameworks or any adapter: `import-linter` enforces
this in CI.

The domain is generic. A **Room** has an optional sensor (or follows another
room) and is served by any number of **Systems**. A System has a `kind`
(`radiator`, `ac`, `dehumidifier`, ... or any string) and references the
adapters that drive it, read its program, apply overrides and measure its power.

### Ports

One interface per adapter family:

| Port | Responsibility |
|---|---|
| `ProgramSource` | read the program and write permanent changes |
| `OverrideStrategy` | apply temporary changes |
| `SystemDriver` | state, action, mode and target of a system |
| `HistorySource` | time series |
| `OutdoorSource` | outdoor data and forecasts |
| `PowerSource` | power and energy |
| `RoomSensor` | room measurements |

### Adapters

Each adapter:

- registers itself in the adapter registry (family, id, API version);
- declares a Pydantic `Config` model, exported as JSON Schema with Hestia
  extensions (`x-ha-entity`, `x-i18n`, `x-advanced`, `x-depends-on`) from which
  the UI generates the setup forms;
- declares its **capabilities**, partly static and partly resolved at startup
  (for example, a YAML-defined schedule is read-only). The UI adapts to them
  instead of assuming a specific HA setup;
- brings its own translation keys (`adapter.<id>.*`).

The author's home setup is just the first set of adapters (`ha_schedule_levels`,
`climate_direct`, `ha_climate`, `ha_sensor`, `influx2`, `ha_recorder`,
`sensor_power`); more adapters, including a no-code `template` adapter, are
planned. External adapters can be installed as Python packages exposing the
`hestia.adapters` entry point.

### Testing kit

`hestia.testing` provides a fake Home Assistant WebSocket server, recorded
fixtures and reusable **contract test** classes (one per port). CI runs them on
every bundled adapter; external plugins can reuse them.

## Principles

- No user-visible text hard-coded in code: everything goes through the
  translation files (see [`locales/README.md`](../locales/README.md)).
- The server works in UTC and returns ISO dates with offset; program slots are
  in local time and the 30-minute grid is computed server-side.
- The UI never assumes a capability: it reads what the adapters declare.
