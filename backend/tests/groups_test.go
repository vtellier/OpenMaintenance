package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Issue #112: groups organise the Equipments list (doc/data-model.md,
// "Group"). These tests pin the API contract of /groups and of an
// equipment's group_id.

// Issue #112: a new group's name is trimmed, its icon defaults to 🗂️, and the
// group is listed.
func TestCreateGroup_TrimsNameAndDefaultsIcon(t *testing.T) {
	e, _, _ := newTestServer(t)

	created := expectJSON(t, send(t, e, http.MethodPost, "/api/groups", map[string]any{"name": "  Winches  "}),
		http.StatusCreated, "create group")
	if created["name"] != "Winches" {
		t.Errorf("name = %v, want Winches", created["name"])
	}
	if created["icon"] != "🗂️" {
		t.Errorf("icon = %v, want 🗂️", created["icon"])
	}

	rec := send(t, e, http.MethodGet, "/api/groups", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("list groups: expected 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	groups := decodeList(t, rec)
	if len(groups) != 1 || groups[0]["id"] != created["id"] || groups[0]["name"] != "Winches" {
		t.Errorf("groups = %v, want only the created Winches", groups)
	}
}

func decodeList(t *testing.T, rec *httptest.ResponseRecorder) []map[string]any {
	t.Helper()
	var out []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode list: %v (%s)", err, rec.Body.String())
	}
	return out
}

// Issue #112: group names are trimmed, required and unique ignoring case, on
// create and on rename; a refused request stores nothing.
func TestGroupName_RequiredAndUniqueIgnoringCase(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		target     string // "new", "winches" (the group being renamed) or "unknown"
		body       map[string]any
		wantStatus int
		wantError  string
		wantNames  []string // the group names afterwards
	}{
		{"create with an empty name", http.MethodPost, "new", map[string]any{"name": "   "},
			http.StatusBadRequest, "Name is required", []string{"Winches", "Safety gear"}},
		{"create with another group's name in another case", http.MethodPost, "new", map[string]any{"name": " winches "},
			http.StatusConflict, "A group with this name already exists", []string{"Winches", "Safety gear"}},
		{"rename to another group's name in another case", http.MethodPut, "winches", map[string]any{"name": "SAFETY GEAR"},
			http.StatusConflict, "A group with this name already exists", []string{"Winches", "Safety gear"}},
		{"rename to an empty name", http.MethodPut, "winches", map[string]any{"name": ""},
			http.StatusBadRequest, "Name is required", []string{"Winches", "Safety gear"}},
		{"rename to its own name in another case", http.MethodPut, "winches", map[string]any{"name": "WINCHES"},
			http.StatusOK, "", []string{"WINCHES", "Safety gear"}},
		{"rename to a new name, trimmed", http.MethodPut, "winches", map[string]any{"name": "  Deck winches "},
			http.StatusOK, "", []string{"Deck winches", "Safety gear"}},
		{"rename a group that does not exist", http.MethodPut, "unknown", map[string]any{"name": "Sails"},
			http.StatusNotFound, "Group not found", []string{"Winches", "Safety gear"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e, _, _ := newTestServer(t)
			winches := expectJSON(t, send(t, e, http.MethodPost, "/api/groups", map[string]any{"name": "Winches"}), http.StatusCreated, "seed Winches")
			expectJSON(t, send(t, e, http.MethodPost, "/api/groups", map[string]any{"name": "Safety gear"}), http.StatusCreated, "seed Safety gear")

			path := "/api/groups"
			switch tt.target {
			case "winches":
				path += "/" + itoa(int(winches["id"].(float64)))
			case "unknown":
				path += "/999"
			}
			got := expectJSON(t, send(t, e, tt.method, path, tt.body), tt.wantStatus, tt.name)
			if tt.wantError != "" && got["error"] != tt.wantError {
				t.Errorf("error = %v, want %q", got["error"], tt.wantError)
			}

			var names []string
			for _, g := range decodeList(t, send(t, e, http.MethodGet, "/api/groups", nil)) {
				names = append(names, g["name"].(string))
			}
			if !sameNames(names, tt.wantNames) {
				t.Errorf("groups = %v, want %v", names, tt.wantNames)
			}
		})
	}
}

// sameNames reports whether two lists hold the same names, in any order.
func sameNames(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	seen := map[string]int{}
	for _, n := range got {
		seen[n]++
	}
	for _, n := range want {
		if seen[n] == 0 {
			return false
		}
		seen[n]--
	}
	return true
}

// Issue #112: an equipment joins a group through its create and edit
// requests. An unknown group is refused and stores nothing; an edit that sends
// no group_id leaves the equipment in no group, like the other metadata.
func TestEquipmentGroup_SetOnCreateAndEdit(t *testing.T) {
	e, _, _ := newTestServer(t)
	winches := expectJSON(t, send(t, e, http.MethodPost, "/api/groups", map[string]any{"name": "Winches"}), http.StatusCreated, "create Winches")
	sails := expectJSON(t, send(t, e, http.MethodPost, "/api/groups", map[string]any{"name": "Sails"}), http.StatusCreated, "create Sails")

	created := expectJSON(t, send(t, e, http.MethodPost, "/api/equipments",
		map[string]any{"name": "Port winch", "group_id": winches["id"]}), http.StatusCreated, "create in Winches")
	if created["group_id"] != winches["id"] {
		t.Errorf("created group_id = %v, want %v", created["group_id"], winches["id"])
	}
	eqPath := "/api/equipments/" + itoa(int(created["id"].(float64)))
	got := expectJSON(t, send(t, e, http.MethodGet, eqPath, nil), http.StatusOK, "get")
	if got["group_id"] != winches["id"] {
		t.Errorf("stored group_id = %v, want %v", got["group_id"], winches["id"])
	}

	// Moved to another group.
	moved := expectJSON(t, send(t, e, http.MethodPut, eqPath,
		map[string]any{"name": "Port winch", "group_id": sails["id"]}), http.StatusOK, "move to Sails")
	if moved["group_id"] != sails["id"] {
		t.Errorf("moved group_id = %v, want %v", moved["group_id"], sails["id"])
	}

	// An unknown group is refused, on create and on edit, and stores nothing.
	rec := send(t, e, http.MethodPost, "/api/equipments", map[string]any{"name": "Ghost", "group_id": 999})
	if refused := expectJSON(t, rec, http.StatusBadRequest, "create in unknown group"); refused["error"] != "Group not found" {
		t.Errorf("error = %v, want Group not found", refused["error"])
	}
	if n := len(decodeList(t, send(t, e, http.MethodGet, "/api/equipments", nil))); n != 1 {
		t.Errorf("equipments after refused create = %d, want 1", n)
	}
	rec = send(t, e, http.MethodPut, eqPath, map[string]any{"name": "Renamed", "group_id": 999})
	if refused := expectJSON(t, rec, http.StatusBadRequest, "move to unknown group"); refused["error"] != "Group not found" {
		t.Errorf("error = %v, want Group not found", refused["error"])
	}
	got = expectJSON(t, send(t, e, http.MethodGet, eqPath, nil), http.StatusOK, "get after refused edit")
	if got["name"] != "Port winch" || got["group_id"] != sails["id"] {
		t.Errorf("after refused edit: name %v, group_id %v; want Port winch in %v", got["name"], got["group_id"], sails["id"])
	}

	// An edit without group_id leaves it in no group.
	ungrouped := expectJSON(t, send(t, e, http.MethodPut, eqPath, map[string]any{"name": "Port winch"}), http.StatusOK, "edit without group")
	if ungrouped["group_id"] != nil {
		t.Errorf("group_id after edit without one = %v, want null", ungrouped["group_id"])
	}
}

// Issue #112: deleting a group ungroups its equipments and never deletes them,
// nor their tasks or interventions. Deleting an equipment keeps its group.
func TestDeleteGroup_UngroupsItsEquipments(t *testing.T) {
	e, h, _ := newTestServer(t)
	winches := expectJSON(t, send(t, e, http.MethodPost, "/api/groups", map[string]any{"name": "Winches"}), http.StatusCreated, "create Winches")
	sails := expectJSON(t, send(t, e, http.MethodPost, "/api/groups", map[string]any{"name": "Sails"}), http.StatusCreated, "create Sails")
	port := expectJSON(t, send(t, e, http.MethodPost, "/api/equipments",
		map[string]any{"name": "Port winch", "group_id": winches["id"]}), http.StatusCreated, "create Port winch")
	genoa := expectJSON(t, send(t, e, http.MethodPost, "/api/equipments",
		map[string]any{"name": "Genoa", "group_id": sails["id"]}), http.StatusCreated, "create Genoa")
	portID := int(port["id"].(float64))
	taskID := seedTask(t, h, portID)
	seedIntervention(t, h, portID, taskID)

	rec := send(t, e, http.MethodDelete, "/api/groups/"+itoa(int(winches["id"].(float64))), nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("delete Winches: expected 204, got %d (%s)", rec.Code, rec.Body.String())
	}

	var names []string
	for _, g := range decodeList(t, send(t, e, http.MethodGet, "/api/groups", nil)) {
		names = append(names, g["name"].(string))
	}
	if !sameNames(names, []string{"Sails"}) {
		t.Errorf("groups = %v, want [Sails]", names)
	}
	got := expectJSON(t, send(t, e, http.MethodGet, "/api/equipments/"+itoa(portID), nil), http.StatusOK, "get Port winch")
	if got["group_id"] != nil {
		t.Errorf("Port winch group_id = %v, want null", got["group_id"])
	}
	if tasks := decodeList(t, send(t, e, http.MethodGet, "/api/equipments/"+itoa(portID)+"/tasks", nil)); len(tasks) != 1 {
		t.Errorf("Port winch tasks = %d, want 1", len(tasks))
	}
	if invs := decodeList(t, send(t, e, http.MethodGet, "/api/interventions", nil)); len(invs) != 1 {
		t.Errorf("interventions = %d, want 1", len(invs))
	}
	got = expectJSON(t, send(t, e, http.MethodGet, "/api/equipments/"+itoa(int(genoa["id"].(float64))), nil), http.StatusOK, "get Genoa")
	if got["group_id"] != sails["id"] {
		t.Errorf("Genoa group_id = %v, want %v (another group's equipment is untouched)", got["group_id"], sails["id"])
	}

	// Deleting the last equipment of a group keeps the group, empty.
	rec = send(t, e, http.MethodDelete, "/api/equipments/"+itoa(int(genoa["id"].(float64))), nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("delete Genoa: expected 204, got %d (%s)", rec.Code, rec.Body.String())
	}
	if groups := decodeList(t, send(t, e, http.MethodGet, "/api/groups", nil)); len(groups) != 1 {
		t.Errorf("groups after deleting Genoa = %v, want Sails kept", groups)
	}

	// An unknown group cannot be deleted.
	rec = send(t, e, http.MethodDelete, "/api/groups/999", nil)
	if refused := expectJSON(t, rec, http.StatusNotFound, "delete unknown group"); refused["error"] != "Group not found" {
		t.Errorf("error = %v, want Group not found", refused["error"])
	}
}
