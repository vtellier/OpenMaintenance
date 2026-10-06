# Contributing to OpenMaintenance

## Tech stack

| Layer | Location | Stack |
|-------|----------|-------|
| Backend | `backend/` | Go + Echo + SQLite |
| Frontend | `frontend/` | Arrow.js + Vite |
| API spec | `backend/api/openapi.yaml` | OpenAPI 3.0 (single source of truth) |

The backend embeds the compiled frontend and serves it as static files. The TypeScript API client is generated from the OpenAPI spec.

## Prerequisites

- Go 1.21+
- Node.js 22.12+ (required by Vitest) + pnpm
- `oapi-codegen` (`go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest`)

## Running locally

```bash
make dev        # starts backend (port 3001) and frontend dev server (port 5173)
```

Or separately:

```bash
# Backend
cd backend && go run .

# Frontend
cd frontend && pnpm dev
```

## Frontend unit tests

Pure frontend logic (formatters, date helpers, form rules) is unit-tested with [Vitest](https://vitest.dev/). It reuses `frontend/vite.config.ts`, so the `@` and `@generated` imports resolve as in the app. Neither server needs to be running.

```bash
cd frontend
pnpm test:unit                       # run once, as CI does
pnpm exec vitest                     # watch mode
TZ=America/New_York pnpm test:unit   # use another timezone as "local"
pnpm exec vitest run --project Europe/Paris   # one timezone only
```

Every test runs once in your own timezone (the `local` project) and once in each timezone listed in `TEST_TIMEZONES` in `vite.config.ts`: UTC, two zones east of it and two west. Date code therefore cannot pass only where it was written. Each timezone runs in its own process (the `forks` pool), because `TZ` applies to a whole process.

Put each test next to the module it covers, named `<module>.test.ts` (e.g. `src/lib/format.test.ts`), and test through the module's exported functions. Vitest only collects `src/**/*.test.ts`; the Playwright specs in `frontend/tests/` keep running with `pnpm test`.

## Common commands

| Task | Command | Working dir |
|------|---------|-------------|
| Build everything | `make build` | repo root |
| Build backend only | `make build-backend` | repo root |
| Build frontend only | `make build-frontend` | repo root |
| Regen OpenAPI Go stubs | `make generate-openapi` | repo root |
| Regen TS API client | `pnpm run generate:api` | `frontend/` |
| Run frontend unit tests | `pnpm test:unit` | `frontend/` |
| Run frontend tests | `pnpm test` | `frontend/` |
| Run backend tests | `go test ./...` | `backend/` |

## Repository structure

```
OpenMaintenance/
├── backend/
│   ├── api/                  # OpenAPI spec (source of truth)
│   ├── internal/
│   │   ├── config/           # Deployment config loader
│   │   ├── db/               # SQLite init and queries
│   │   ├── generated/        # Auto-generated — do not edit
│   │   ├── handlers/         # Echo route handlers
│   │   ├── logic/            # Business logic (due status, etc.)
│   │   └── models/           # Go data models
│   ├── static/               # Auto-generated — do not edit
│   ├── tests/                # Black-box HTTP tests (package tests)
│   └── main.go
├── frontend/
│   ├── generated/            # Auto-generated — do not edit
│   ├── src/                  # App code, with Vitest unit tests beside it (*.test.ts)
│   └── tests/non-regression/ # Playwright non-regression specs
├── doc/                      # Product specs (source of truth for behaviour)
│   ├── overview.md
│   ├── data-model.md
│   ├── configuration.md
│   ├── localisation.md
│   └── gui/                  # Per-screen UI specs
├── AGENTS.md                 # Guide for coding agents
├── ROADMAP.md                # Development progress
└── STATUS.md                 # Session-by-session activity log
```

## Workflow

### Spec first

Before writing any code, update the relevant file in `doc/` to describe the new behaviour. Get agreement on the spec before touching implementation.

### Modifying the API

1. Edit `backend/api/openapi.yaml`
2. `make generate-openapi` — regenerates Go stubs
3. `pnpm run generate:api` in `frontend/` — regenerates TS client

### Do not edit generated files

- `backend/internal/generated/openapi.gen.go`
- `frontend/generated/`
- `backend/static/`

### Bug fixes — test at the right layer

Every bug fix must be accompanied by a test that fails on the unfixed code. Pin the bug at the **lowest layer that can produce it**:

| Where the bug lives | Failing test goes in | Style | Run with |
|---|---|---|---|
| Business logic (`internal/logic/`, `internal/db/` query behaviour) | `backend/internal/<pkg>/*_test.go`, next to the code | table-driven, no HTTP | `cd backend && go test ./...` |
| API contract / handler (status codes, validation, response shape, cascades) | `backend/tests/*_test.go` | `httptest` via the existing `newTestServer(t)` harness | `make test-backend` |
| Frontend rendering / interaction / reactivity | `frontend/tests/non-regression/*.spec.ts` | Playwright | `pnpm test` from `frontend/` |

Add a Playwright spec on top of a backend test only when the UI can regress independently of the backend.

`backend/tests/` is a black-box `package tests`; the shared harness `newTestServer(t)` and the `seedEquipment` / `seedHourEquipment` helpers live there already — reuse them rather than writing a new one. Note that `make test-backend` currently runs `go test ./tests/...` only, so run `go test ./...` from `backend/` when you add an in-package test.

All existing tests must still pass before you commit.

### Git

- One commit per logical change
- Update `ROADMAP.md` when completing a milestone item
- Append a summary to `STATUS.md` at the end of a working session

### Schema migrations

The SQLite database carries its own `schema_version` in a `meta` table. When you change the schema, append a numbered migration in `backend/internal/db/migrations.go` and bump `CurrentSchemaVersion`. See [`doc/db-migration.md`](./doc/db-migration.md) for the bootstrap rules and startup flow.

### Releases and versioning

Versions follow [Semantic Versioning](https://semver.org/) with a `v` prefix (`v1.2.3`). The version is derived at build time from git tags via `git describe --tags --always --dirty` — no `VERSION` file to maintain.

To cut a release:
```bash
git tag v1.2.3
git push origin v1.2.3
```

CI/CD picks up the tag and produces versioned release binaries named `openmaintenance-vX.Y.Z` (Linux) and `openmaintenance-vX.Y.Z.exe` (Windows). Between releases, local builds show `v1.2.3-N-gSHA` (N commits after the tag) in the filename. Uncommitted changes append `-dirty`.

## Coding agents

See [`AGENTS.md`](./AGENTS.md) for the full agent guide, skill map, and rules.
