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
- Node.js + pnpm
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

## Common commands

| Task | Command | Working dir |
|------|---------|-------------|
| Build everything | `make build` | repo root |
| Build backend only | `make build-backend` | repo root |
| Build frontend only | `make build-frontend` | repo root |
| Regen OpenAPI Go stubs | `make generate-openapi` | repo root |
| Regen TS API client | `pnpm run generate:api` | `frontend/` |
| Run frontend tests | `pnpm test` | `frontend/` |

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
│   └── main.go
├── frontend/
│   ├── generated/            # Auto-generated — do not edit
│   ├── src/
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

### Frontend bugs

Every frontend bug fix must be accompanied by a Playwright non-regression spec in `frontend/tests/non-regression/`. Run `pnpm test` before committing — all specs must pass.

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
