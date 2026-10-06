---
name: go-test
description: Write or run Go tests for OpenMaintenance backend bugs — table-driven in-package tests for business logic, and httptest handler tests via the newTestServer harness. Use when pinning a backend bug with a failing test, or when asked to add or run backend tests.
---

# Go tests (backend)

This is the **Go branch** of the bug-fix process. The Playwright branch lives in
[`.agents/skills/non-regression-test/SKILL.md`](../non-regression-test/SKILL.md);
the branching decision itself is Step 3.5 of [`.agents/skills/bug-fix/SKILL.md`](../bug-fix/SKILL.md).

Use this skill whenever the bug reproduces without a browser.

## Two kinds of Go test — pick the right one

| | In-package (white-box) | `backend/tests/` (black-box) |
|---|---|---|
| Location | beside the code: `backend/internal/<pkg>/<file>_test.go` | `backend/tests/<area>_test.go` |
| Package | same as the code (`package logic`) | `package tests` |
| Covers | pure functions, business rules, query behaviour | HTTP contract: status codes, validation, response shape, cascades |
| Style | table-driven, no HTTP, no DB where avoidable | `httptest` against a real Echo server + temp SQLite DB |
| Speed | milliseconds | tens of milliseconds |
| Precedent | `backend/internal/updater/updater_test.go` | `backend/tests/equipment_hours_test.go` |

**Pick the lowest one that reproduces the bug.** If a plain function call shows the wrong answer, the test belongs beside the function — not behind an HTTP round-trip.

## Where things live

- Business logic: `backend/internal/logic/` (e.g. `due_status.go` → `ComputeDueStatus`)
- DB access: `backend/internal/db/`
- Handlers: `backend/internal/handlers/`
- Models: `backend/internal/models/`
- Black-box HTTP tests: `backend/tests/`

## Running

```sh
cd backend && go test ./...                      # everything, in-package tests included
cd backend && go test ./internal/logic/... -v    # one package
cd backend && go test ./... -run TestComputeDueStatus -v
make test-backend                                # repo root — currently ./tests/... only
```

> `make test-backend` still runs `go test ./tests/...`, so it does **not** pick up in-package tests. Widening it to `go test ./...` is tracked in issue #61. Until that lands, run `cd backend && go test ./...` before you commit.

## Branch A — in-package, table-driven

Write the test in the same package as the code so you can call unexported helpers and construct exact inputs.

```go
package logic

import (
	"testing"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

// Issue #N: <one-line bug description>
func TestComputeDueStatus_NoIntervention(t *testing.T) {
	tests := []struct {
		name       string
		task       models.Task
		equipment  models.Equipment
		last       *models.Intervention
		wantStatus string
	}{
		{
			name:       "never done, interval elapsed since creation → overdue",
			task:       models.Task{MonthsInterval: intPtr(3)},
			equipment:  models.Equipment{CreatedAt: time.Now().AddDate(0, -6, 0)},
			last:       nil,
			wantStatus: "overdue",
		},
		// one row per edge case
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, _, _ := ComputeDueStatus(tt.task, tt.equipment, tt.last)
			if got != tt.wantStatus {
				t.Errorf("status = %q, want %q", got, tt.wantStatus)
			}
		})
	}
}
```

Conventions:
- One `t.Run` per row; the row `name` is the scenario in plain words.
- Assert the **correct** value, not merely "not the buggy value".
- Cover the boundary, not just the middle: exactly-at-threshold, zero, nil, missing.

## Branch B — black-box HTTP via `newTestServer`

`backend/tests/` is a separate `package tests`. **The harness already exists — do not build a new one.**

```go
func newTestServer(t *testing.T) (*echo.Echo, *handlers.Handler, string)
```
Defined at `backend/tests/equipment_file_test.go:23`. It:
- creates a fresh SQLite DB in `t.TempDir()` via `db.InitDB(dbPath, "test", db.BackupConfig{Enabled: false})` — backups disabled,
- builds `&handlers.Handler{DB: database, Version: "test", BaseDir: dir}`,
- registers the generated routes with `generated.RegisterHandlersWithBaseURL(e, h, "/api")`,
- registers `t.Cleanup` to close the DB,
- returns the Echo server, the handler (for direct DB seeding) and the base dir (the `files/` tree lives alongside the DB).

Existing package-level helpers — reuse them rather than duplicating:

| Helper | File | Purpose |
|---|---|---|
| `seedEquipment(t, h) int` | `backend/tests/equipment_file_test.go:40` | creates a plain equipment, returns its ID |
| `seedHourEquipment(t, h, hours, staleFor) int` | `backend/tests/equipment_hours_test.go:19` | hour-tracked equipment with a back-dated `HoursUpdatedAt` |
| `itoa(i) string` | `backend/tests/equipment_file_test.go:68` | `strconv.Itoa`, for building URLs |

Shape of a request test:

```go
func TestUpdateEquipmentHours_SameValueRefreshesTimestamp(t *testing.T) {
	e, h, _ := newTestServer(t)
	id := seedHourEquipment(t, h, 100, 30*24*time.Hour)

	body, _ := json.Marshal(map[string]float64{"hours": 100})
	req := httptest.NewRequest(http.MethodPut, "/api/equipments/"+itoa(id)+"/hours", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	// then assert on the DB state via db.GetEquipment(h.DB, id)
}
```

Conventions:
- Always include `rec.Body.String()` in the failure message — a bare status code tells you nothing.
- Seed through `db.*` functions on `h.DB`, not through chained API calls, unless the chaining is what you are testing.
- Set up state relative to `time.Now()` (`time.Now().Add(-30*24*time.Hour)`), never with a hard-coded date.

## Naming

- File: the area under test — `due_status_test.go`, `equipment_hours_test.go`. In-package files sit next to the file they test and mirror its name.
- Test function: `Test<Unit>_<Scenario>` — `TestComputeDueStatus_NoIntervention`, `TestUpdateEquipmentHours_SameValueRefreshesTimestamp`.
- Add a comment above the test naming the issue it pins: `// Issue #59: tasks with no intervention render green.`

## Gotchas / Pitfalls

### 1. `backend/tests/` is black-box — unexported identifiers are invisible

`package tests` can only reach exported API. If the test needs an unexported function or field, that is the signal it belongs in-package instead.

### 2. `make test-backend` does not run in-package tests yet

It is `go test ./tests/...`. An in-package test you add today passes CI-silently because nothing runs it. Run `cd backend && go test ./...` yourself until issue #61 widens the target.

### 3. Don't reach for the DB when the function is pure

`ComputeDueStatus` takes plain `models` values. Building a database to test it makes the test slower and hides the actual inputs. Construct the structs directly.

### 4. Time-dependent tests must be relative

A test asserting "overdue" against a date literal will start failing on some future day. Always derive fixtures from `time.Now()`. If a function reads the clock internally and that makes it untestable, that is a finding — raise it rather than testing around it with sleeps.

### 5. Never share state between tests

`newTestServer(t)` gives every test its own temp DB and cleanup. Call it per test; do not hoist a server into a package-level variable or `TestMain`.

### 6. Assert on the fixed behaviour, not on the symptom's absence

"Status is not `ok`" passes when the code returns garbage. Assert the exact expected status, date and hours.

### 7. Pointer fields in models

Several model fields are pointers (`Task.MonthsInterval *int`, `Task.HoursInterval *int`, `Equipment.Hours *float64`, `Equipment.HoursUpdatedAt *time.Time`, `Intervention.HoursAt *float64`), and `lastIntervention` itself may be `nil`. `nil` is a meaningful state — usually the very edge case a bug lives in. Add a small local `intPtr`/`f64Ptr` helper in the test file and cover both `nil` and set.

### 8. A backend fix can still break the frontend

An in-package test passing does not clear you to skip `pnpm test` when the fix changes what the API returns. See Step 6 of the bug-fix skill.
