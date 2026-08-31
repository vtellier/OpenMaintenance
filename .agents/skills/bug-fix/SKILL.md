---
name: bug-fix
description: Entry point for fixing any bug in OpenMaintenance. Enforces the full workflow: GitHub issue → reproduce → classify the layer → failing test at that layer → fix → PR.
---

# Bug fix workflow

Load this skill at the start of every bug fix session. Do not write any code until all pre-fix steps are complete.

A bug can live in Go business logic, in the API contract, or in the browser. The steps below are the same for all three; **Steps 3, 4 and 6 branch on the layer** you determine in Step 3.5.

## Step 1 — GitHub issue

Confirm a GitHub issue exists for this bug. If not, create one before proceeding.

The issue number will be used for the branch name: `fix/issue-N-short-slug`.

## Step 2 — Read the spec

Read the spec for the affected behaviour:

- UI behaviour → the GUI spec for that screen (`doc/gui/`)
- Scheduling / due-status / hour-meter rules → [`doc/data-model.md`](../../../doc/data-model.md)
- Request/response shape, status codes → `backend/api/openapi.yaml`

Confirm the behaviour is actually a bug and not the intended design. If it matches the spec, it is not a bug — clarify with the user before continuing.

## Step 3 — Reproduce

Do not rely on a verbal description alone — observe the bug yourself. How you reproduce it depends on where you suspect it lives; if you are not sure yet, start at the top (browser) and work down until you find the lowest layer that still shows the bug.

| Suspected layer | Reproduce with |
|---|---|
| Business logic (`internal/logic/`, `internal/db/` query behaviour) | a throwaway Go test, or `go run` against the function directly |
| API / handler | `curl` against a running backend (`go run .` from `backend/`) |
| Frontend | Chrome DevTools MCP against `pnpm dev` |

## Step 3.5 — Classify the bug by layer

**Rule of thumb: pin the bug at the lowest layer that can produce it.** A browser test that fails because a Go function computes the wrong status is slow, indirect, and cannot cover the edge cases that matter. Add a Playwright spec on top only when the browser can break independently of the backend.

| Where the bug lives | Reproduce with | Failing test goes in | Style |
|---|---|---|---|
| Pure business logic (`internal/logic/`, `internal/db/` query behaviour) | a Go test, directly | `backend/internal/<pkg>/*_test.go` — **next to the code** (e.g. `backend/internal/logic/due_status_test.go`) | table-driven, no HTTP |
| API contract / handler (status codes, validation, response shape, cascade behaviour) | `curl` against `go run .` | `backend/tests/*_test.go` | `httptest` via the existing `newTestServer(t)` harness |
| Frontend rendering / interaction / reactivity | Chrome DevTools MCP | `frontend/tests/non-regression/*.spec.ts` | Playwright — follow the non-regression skill |
| Cross-layer (wrong data **and** wrong display) | both | both | pin the root cause in Go; add a Playwright spec only if the UI can regress independently |

Questions that resolve the classification quickly:

- Does the bug reproduce from a plain Go function call, with no server and no browser? → **business logic**.
- Does it reproduce with `curl` but not from the function alone (wrong status code, missing field, bad validation, cascade not applied)? → **API / handler**.
- Does `curl` return correct data while the screen shows the wrong thing? → **frontend**.

State your classification explicitly before moving to Step 4, so the choice of test file is deliberate rather than habitual.

## Step 4 — Write the failing test (before any fix)

Whatever the layer, the test must:
- reproduce the exact bug you just observed
- **fail on the current (unfixed) code**, for the right reason

Do not proceed to Step 5 until you have seen it fail.

### Branch A — business logic (Go, in-package)

Load the Go test skill: [`.agents/skills/go-test/SKILL.md`](../go-test/SKILL.md)

Write a table-driven test **beside the code** — e.g. `backend/internal/logic/due_status_test.go`, in `package logic` — so it is white-box and fast. Precedent: `backend/internal/updater/updater_test.go`.

Run it:
```sh
cd backend && go test ./internal/logic/... -run TestComputeDueStatus -v
```

> Note: `make test-backend` currently runs only `go test ./tests/...`, so in-package tests are not picked up by it yet (tracked in issue #61). Until that lands, run `cd backend && go test ./...` yourself.

### Branch B — API / handler (Go, black-box HTTP)

Load the Go test skill: [`.agents/skills/go-test/SKILL.md`](../go-test/SKILL.md)

Add a test to `backend/tests/` (`package tests`) using the existing harness — do not build a new one:

```go
func newTestServer(t *testing.T) (*echo.Echo, *handlers.Handler, string)
```
defined at `backend/tests/equipment_file_test.go:23`. It creates a fresh temp-dir SQLite DB via `db.InitDB(dbPath, "test", db.BackupConfig{Enabled: false})`, registers the generated routes at `/api`, and registers `t.Cleanup`. Package-level helpers `seedEquipment`, `seedHourEquipment` and `itoa` already exist — reuse them.

Run it:
```sh
make test-backend          # go test ./tests/...
```

### Branch C — frontend (Playwright)

Load the non-regression-test skill: [`.agents/skills/non-regression-test/SKILL.md`](../non-regression-test/SKILL.md)

Write a spec in `frontend/tests/non-regression/`, run `pnpm test` from `frontend/`, and add a row to `frontend/tests/non-regression/README.md`.

### Branch D — cross-layer

Do Branch A or B for the root cause **first**. Add a Branch C spec only if the UI can regress on its own (e.g. a formatter or a rendering condition that is independent of the API payload). Two tests, still two commits: both tests go in the failing-test commit.

## Step 5 — Apply the fix

Now implement the fix. Keep it scoped — do not refactor or clean up unrelated code.

## Step 6 — Verify

Run the suite for the layer you touched, plus the full build:

| Layer | Verify with |
|---|---|
| Business logic | `cd backend && go test ./...` |
| API / handler | `make test-backend` (and `cd backend && go test ./...` if you also added an in-package test) |
| Frontend | `pnpm test` from `frontend/` |

Your new test must pass. **All existing tests must still pass** — a backend fix does not exempt you from `pnpm test` if it can change what the UI receives, and vice versa. When in doubt, run both suites.

Run `make build` from the repo root to confirm no build regressions.

## Step 7 — Commit and PR

- One commit for the failing test, one commit for the fix (or a single combined commit if they are trivial — ask the user). This is unchanged for every branch above, Go tests included.
- Open a PR referencing the issue (`Closes #N`).
- Always ask for confirmation before running any `gh` command.
