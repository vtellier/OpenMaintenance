package tests

import (
	"net/http"
	"testing"
	"time"
)

// Issue #113: an equipment that left service is decommissioned: it records
// decommissioned_at and its tasks are never due (doc/data-model.md,
// "Decommissioning"). These tests pin the API contract.

// dueFields are the computed fields a task of a decommissioned equipment has
// none of.
var dueFields = []string{"due_status", "next_due_date", "next_due_hours", "due_trigger", "due_in_days", "due_in_hours", "urgency"}

// equipmentByID finds an equipment in GET /api/equipments.
func equipmentByID(t *testing.T, list []map[string]any, id any) map[string]any {
	t.Helper()
	for _, eq := range list {
		if eq["id"] == id {
			return eq
		}
	}
	t.Fatalf("equipment %v not listed", id)
	return nil
}

// Issue #113: the date is set and cleared through the edit request, like the
// other metadata, and is read back from every equipment endpoint. While it is
// set, the equipment's tasks have no due fields; clearing it brings them back.
func TestDecommissionedEquipment_EditSetsAndClearsTheDate(t *testing.T) {
	e, _, _ := newTestServer(t)
	created := expectJSON(t, send(t, e, http.MethodPost, "/api/equipments", map[string]any{"name": "Old dinghy"}),
		http.StatusCreated, "create equipment")
	if created["decommissioned_at"] != nil {
		t.Fatalf("new equipment decommissioned_at = %v, want null (in service)", created["decommissioned_at"])
	}
	id := int(created["id"].(float64))
	path := "/api/equipments/" + itoa(id)
	// Never done, no commissioning date: overdue while in service.
	task := expectJSON(t, send(t, e, http.MethodPost, "/api/tasks", map[string]any{"equipment_id": id, "name": "Hull check", "months_interval": 12}),
		http.StatusCreated, "create task")
	taskPath := "/api/tasks/" + itoa(int(task["id"].(float64)))

	updated := expectJSON(t, send(t, e, http.MethodPut, path, map[string]any{"name": "Old dinghy", "decommissioned_at": "2025-06-01"}),
		http.StatusOK, "decommission")
	if updated["decommissioned_at"] != "2025-06-01" {
		t.Errorf("edit response decommissioned_at = %v, want 2025-06-01", updated["decommissioned_at"])
	}
	got := expectJSON(t, send(t, e, http.MethodGet, path, nil), http.StatusOK, "get equipment")
	if got["decommissioned_at"] != "2025-06-01" {
		t.Errorf("get decommissioned_at = %v, want 2025-06-01", got["decommissioned_at"])
	}
	listed := equipmentByID(t, decodeList(t, send(t, e, http.MethodGet, "/api/equipments", nil)), created["id"])
	if listed["decommissioned_at"] != "2025-06-01" {
		t.Errorf("list decommissioned_at = %v, want 2025-06-01", listed["decommissioned_at"])
	}

	tasks := decodeList(t, send(t, e, http.MethodGet, "/api/tasks", nil))
	if len(tasks) != 1 {
		t.Fatalf("tasks = %v, want the one task", tasks)
	}
	for _, field := range dueFields {
		if v, ok := tasks[0][field]; ok {
			t.Errorf("task of a decommissioned equipment has %s = %v, want none", field, v)
		}
	}

	// An edit without the date puts the equipment back in service.
	back := expectJSON(t, send(t, e, http.MethodPut, path, map[string]any{"name": "Old dinghy"}),
		http.StatusOK, "back in service")
	if back["decommissioned_at"] != nil {
		t.Errorf("after an edit without it, decommissioned_at = %v, want null", back["decommissioned_at"])
	}
	again := expectJSON(t, send(t, e, http.MethodGet, taskPath, nil), http.StatusOK, "get task")
	if again["due_status"] != "overdue" {
		t.Errorf("back in service, due_status = %v, want overdue", again["due_status"])
	}
}

// Issue #113: the create request accepts the date too, e.g. for gear already
// gone that is entered for its history.
func TestDecommissionedEquipment_CreateWithTheDate(t *testing.T) {
	e, _, _ := newTestServer(t)
	created := expectJSON(t, send(t, e, http.MethodPost, "/api/equipments",
		map[string]any{"name": "Old outboard", "commissioned_at": "2015-04-01", "decommissioned_at": "2024-09-30"}),
		http.StatusCreated, "create decommissioned equipment")
	if created["decommissioned_at"] != "2024-09-30" {
		t.Errorf("decommissioned_at = %v, want 2024-09-30", created["decommissioned_at"])
	}
}

// earliestToday is today's date in the earliest timezone on Earth (UTC+14),
// shifted by n days: the API refuses only a date in the future everywhere.
func earliestToday(n int) string {
	return time.Now().In(time.FixedZone("UTC+14", 14*60*60)).AddDate(0, 0, n).Format("2006-01-02")
}

// Issue #113: the date cannot be malformed, in the future, or before the
// commissioning date when that is a valid date. A refused edit stores
// nothing; an empty date is none (doc/data-model.md, "Decommissioning").
func TestDecommissionedEquipment_DateRules(t *testing.T) {
	tests := []struct {
		name       string
		body       map[string]any
		wantStatus int
		wantError  string
		wantDate   any // decommissioned_at read back afterwards
	}{
		{"not a YYYY-MM-DD date", map[string]any{"decommissioned_at": "01/03/2025"},
			http.StatusBadRequest, "Decommissioning date must be a YYYY-MM-DD date", nil},
		{"in the future everywhere", map[string]any{"decommissioned_at": earliestToday(1)},
			http.StatusBadRequest, "Decommissioning date cannot be in the future", nil},
		{"today somewhere on Earth", map[string]any{"decommissioned_at": earliestToday(0)},
			http.StatusOK, "", earliestToday(0)},
		{"the day before the commissioning date", map[string]any{"commissioned_at": "2020-05-01", "decommissioned_at": "2020-04-30"},
			http.StatusBadRequest, "Decommissioning date cannot be before the commissioning date", nil},
		{"the commissioning date itself", map[string]any{"commissioned_at": "2020-05-01", "decommissioned_at": "2020-05-01"},
			http.StatusOK, "", "2020-05-01"},
		{"a commissioning date moved after it", map[string]any{"commissioned_at": "2024-01-01", "decommissioned_at": "2023-12-31"},
			http.StatusBadRequest, "Decommissioning date cannot be before the commissioning date", nil},
		{"a malformed commissioning date is unset", map[string]any{"commissioned_at": "not-a-date", "decommissioned_at": "2019-01-01"},
			http.StatusOK, "", "2019-01-01"},
		{"an empty date is none", map[string]any{"decommissioned_at": ""},
			http.StatusOK, "", nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e, _, _ := newTestServer(t)
			created := expectJSON(t, send(t, e, http.MethodPost, "/api/equipments", map[string]any{"name": "Life raft"}),
				http.StatusCreated, "create equipment")
			path := "/api/equipments/" + itoa(int(created["id"].(float64)))

			body := map[string]any{"name": "Life raft"}
			for k, v := range tt.body {
				body[k] = v
			}
			got := expectJSON(t, send(t, e, http.MethodPut, path, body), tt.wantStatus, tt.name)
			if tt.wantError != "" && got["error"] != tt.wantError {
				t.Errorf("error = %v, want %q", got["error"], tt.wantError)
			}

			after := expectJSON(t, send(t, e, http.MethodGet, path, nil), http.StatusOK, "get equipment")
			if after["decommissioned_at"] != tt.wantDate {
				t.Errorf("decommissioned_at = %v, want %v", after["decommissioned_at"], tt.wantDate)
			}
		})
	}
}

// Issue #113: the create request follows the same rules, and a refused one
// creates nothing.
func TestDecommissionedEquipment_CreateRefusesAFutureDate(t *testing.T) {
	e, _, _ := newTestServer(t)
	got := expectJSON(t, send(t, e, http.MethodPost, "/api/equipments",
		map[string]any{"name": "Life raft", "decommissioned_at": earliestToday(1)}),
		http.StatusBadRequest, "create with a future date")
	if got["error"] != "Decommissioning date cannot be in the future" {
		t.Errorf("error = %v, want the future-date reason", got["error"])
	}
	if list := decodeList(t, send(t, e, http.MethodGet, "/api/equipments", nil)); len(list) != 0 {
		t.Errorf("equipments = %v, want none", list)
	}
}
