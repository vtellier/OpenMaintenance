# OpenMaintenance Agent Guide

## Project Overview

- **Purpose**: Free, open-source web app for tracking maintenance tasks (boats, cars, homes, etc.).
- **Self-hostable**: Designed to be easily self-hosted.
- **Minimalist**: Lightweight by design — no heavy frameworks.

## Architecture

| Layer | Location | Stack |
|-------|----------|-------|
| Backend | `backend/` | Go + Echo + SQLite |
| Frontend | `frontend/` | Arrow.js + Vite |
| API spec | `backend/api/openapi.yaml` | OpenAPI (single source of truth) |

The backend serves the frontend as embedded static files. The frontend TypeScript client is generated from the OpenAPI spec.

## Agent Map

### Starting a new feature
1. Read [`doc/overview.md`](./doc/overview.md) — product vision and principles
2. Read [`doc/data-model.md`](./doc/data-model.md) — Equipment, Task, Intervention, hour-meter rules
3. Read the relevant GUI spec in [`doc/gui/`](./doc/gui/) — navigation, dashboard, equipments, tasks, interventions, history, settings
4. Read `backend/api/openapi.yaml` — API contract
5. Load the Arrow.js skill: `.agents/skills/arrow-js/SKILL.md`

**Spec first, code second**: before writing any implementation, update the relevant files in `doc/` to reflect the new behaviour. Present the spec to the user and wait for approval before touching any code.

### Fixing a frontend bug
1. Read the GUI spec for the affected screen
2. Load the non-regression test skill: `.agents/skills/non-regression-test/SKILL.md`
3. Reproduce with Chrome DevTools MCP before touching code

### Modifying the API
1. Edit `backend/api/openapi.yaml` first
2. Run `make generate-openapi` to regenerate the Go server stubs
3. Run `pnpm run generate:api` in `frontend/` to regenerate the TS client

### Do not touch (generated files)
- `backend/internal/generated/openapi.gen.go` — regenerate via `make generate-openapi`
- `frontend/generated/` — regenerate via `pnpm run generate:api` in `frontend/`
- `backend/static/` — regenerate via `make build`

## Commands

| Task | Command | Working dir |
|------|---------|-------------|
| Start both servers | `make dev` | repo root |
| Start backend | `go run .` | `backend/` |
| Start frontend (dev) | `pnpm dev` | `frontend/` |
| Build everything | `make build` | repo root |
| Build backend only | `make build-backend` | repo root |
| Build frontend only | `make build-frontend` | repo root |
| Regen OpenAPI (Go) | `make generate-openapi` | repo root |
| Regen API client (TS) | `pnpm run generate:api` | `frontend/` |
| Run frontend tests | `pnpm test` | `frontend/` |

Servers run on:
- Backend: `http://localhost:3001`
- Frontend (dev): `http://localhost:5173`

> See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for repo structure, workflow, and setup instructions.

## Skills

| Skill | File | When to use |
|-------|------|-------------|
| Arrow.js | `.agents/skills/arrow-js/SKILL.md` | Any frontend code change |
| Non-regression tests | `.agents/skills/non-regression-test/SKILL.md` | Fixing or testing frontend bugs |

## Rules

### Code quality
- After every frontend change: `pnpm run build` in `frontend/`
- After every backend change: `go build` in `backend/`
- Before modifying Arrow.js or Go/Echo code: re-read the **Gotchas / Pitfalls** section in the relevant skill file
- Use `curl` to test backend changes; use Chrome DevTools MCP for frontend

### Frontend bugs
- Load the non-regression-test skill before writing any fix
- Verify the bug against `doc/` specs — confirm it is actually a bug
- Reproduce with Chrome DevTools MCP first
- Pin every bug with a Playwright spec in `frontend/tests/non-regression/`
- Run `pnpm test` after fixing; all specs must pass
- One commit per bug

### Git and documentation
- Update `README.md` after every change (keep it short, no code examples)
- Append a session summary to `STATUS.md` before ending a session
- Update `ROADMAP.md` after completing work (`/update-roadmap` command or manual)
- One commit per logical change; ask for confirmation before committing

### Behavior
- Ask when there is ambiguity — do not guess
- Medium sized answers — answer only what was asked
- Do not over-plan — match scope to the request
- Do not delete unrecognized files
- Do not compact context without asking for confirmation
- When a port is busy, identify the process and offer to kill it — do not switch ports

### Background tasks (OpenCode only)
- Use the `opencode-pty` plugin to run background tasks — never bypass it

## Prerequisites

- **chrome-devtools-mcp** (global npm): `npm install -g chrome-devtools-mcp`
