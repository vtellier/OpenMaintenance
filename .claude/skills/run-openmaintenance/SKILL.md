---
name: run-openmaintenance
description: Build, run, seed, and drive OpenMaintenance. Use when asked to start the app, run it, seed it with demo data, take a screenshot of its UI, interact with the running app, or verify a frontend or backend change.
---

OpenMaintenance is a Go + Arrow.js web app served from a single binary on port 3001. Drive it with the Chrome DevTools MCP — start the backend, then navigate and interact via `mcp__chrome-devtools__*` tools. No separate driver file needed.

All paths below are relative to the repo root.

## Prerequisites

Go and pnpm must be installed (already present in this repo's dev environment). No additional `apt-get` needed.

## Build

```bash
make build
```

This compiles the frontend (Vite), copies the dist into `backend/static/`, and builds the Go binary at `backend/bin/openmaintenance`.

## Run (agent path)

Start the backend as a **Claude-tracked background task** — use the Bash tool
with `run_in_background: true`, **not** a shell `&`. A shell `&` detaches the
process and its logs are lost; `run_in_background` keeps the server alive across
turns and lets you read its logs at any time with `BashOutput`.

```
Bash  command="cd backend && ./bin/openmaintenance"  run_in_background=true
```

Wait until it answers, then seed a realistic dataset and print the LAN URL so
the app can be opened from a phone on the same network:

```bash
timeout 30 bash -c 'until curl -sf http://localhost:3001/api/version >/dev/null; do sleep 1; done'
make seed                                   # demo data: overdue / due-soon / OK
echo "Phone: http://$(hostname -I | awk '{print $1}'):3001"
```

The Go server binds all interfaces, so the built app on `:3001` is already
reachable from other devices — no `--host` flag needed for the agent path.
Check logs any time with `BashOutput` against the background task id.

Then drive via Chrome DevTools MCP:

```
mcp__chrome-devtools__new_page  url=http://localhost:3001
mcp__chrome-devtools__wait_for  text=["Dashboard"]
mcp__chrome-devtools__take_screenshot  filePath=/tmp/om-screenshot.png
```

Navigate between pages:

```
mcp__chrome-devtools__navigate_page  type=url  url=http://localhost:3001/equipments
mcp__chrome-devtools__wait_for  text=["Equipments"]
mcp__chrome-devtools__take_snapshot          ← get UIDs for clicking
mcp__chrome-devtools__click  uid=<uid>
```

Stop when done by killing the background task (use the task id from the
`run_in_background` call), or `kill $(lsof -ti:3001)` as a fallback.

## Run (human path)

```bash
make dev   # starts backend on :3001 and frontend dev server on :5173
```

Open `http://localhost:3001` in a browser. Ctrl-C to stop.

For frontend hot-reload during development:

```bash
cd frontend && pnpm dev --host   # serve on :5173, accessible from other devices
```

## Test

```bash
cd frontend && pnpm test
```

Playwright non-regression tests run against a live backend. Start the backend first (see above).

## Gotchas

- **`make dev` vs `make build`**: `make dev` runs the frontend dev server separately and does not embed it in the binary. For verifying a production build, always use `make build` then run `backend/bin/openmaintenance`.
- **DB is persisted**: The backend uses `backend/maintenance.db`. Tests use a separate DB. The dev DB contains real fixture data from previous sessions — don't be surprised by existing equipment entries.
- **Backup on startup**: The backend creates a timestamped DB backup in `backend/bin/backups/` each run. These accumulate; clean them up manually if needed.
- **Port conflicts**: If port 3001 is busy, find the PID with `lsof -ti:3001` and kill it — don't switch ports.
- **Readiness probe**: there is no `/api/health` endpoint. Use `GET /api/version` (returns 200 + JSON) to confirm the server is up before seeding or navigating.
- **Seeding**: `make seed` POSTs a demo dataset (3 equipments, 8 tasks, 13 interventions) into the **running** backend via the REST API, with dates relative to today so the Dashboard always shows a real Overdue / Due-soon / OK spread. It appends — for a clean slate, stop the server, delete `backend/maintenance.db` (or `backend/bin/maintenance.db` for a built binary), restart, then seed. Source: `backend/cmd/seed/main.go`.
