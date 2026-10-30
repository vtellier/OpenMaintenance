package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

// Issue #102: a negative hour-meter reading was accepted on every path that
// takes one. Each path must answer 400 with a reason and store nothing.

// negativeReason is the exact reason shown to the user, with no field-name
// prefix, on every path.
const negativeReason = "Hours cannot be negative"

// expectNegativeRejected fails unless rec is a 400 whose error is exactly
// negativeReason.
func (f *meterFixture) expectNegativeRejected(rec *httptest.ResponseRecorder, what string) {
	f.t.Helper()
	f.expect(rec, http.StatusBadRequest, what)
	var body struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		f.t.Fatalf("%s: decode error body: %v (%s)", what, err, rec.Body.String())
	}
	if body.Error != negativeReason {
		f.t.Errorf("%s: error = %q, want %q", what, body.Error, negativeReason)
	}
}

// seedHourEquipmentWithoutReading creates an hour-tracked equipment that has
// no reading yet, so no "cannot go backwards" rule can mask the negative one.
func seedHourEquipmentWithoutReading(t *testing.T, f *meterFixture) int {
	t.Helper()
	body := map[string]any{"name": "Engine", "tracks_hours": true}
	return f.createdID(f.do(http.MethodPost, "/equipments", body), "create equipment")
}

func listInterventions(t *testing.T, f *meterFixture) []models.Intervention {
	t.Helper()
	rec := f.do(http.MethodGet, "/interventions", nil)
	f.expect(rec, http.StatusOK, "list interventions")
	var list []models.Intervention
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode interventions: %v", err)
	}
	return list
}

func TestLogIntervention_NegativeReadingRejected(t *testing.T) {
	cases := []struct {
		name string
		body func(equipmentID, taskID int) map[string]any
	}{
		{"standard intervention", func(_, taskID int) map[string]any {
			return interventionBody(taskID, -5)
		}},
		{"exceptional intervention", func(equipmentID, _ int) map[string]any {
			return map[string]any{
				"equipment_id":      equipmentID,
				"exceptional_label": "Replaced impeller",
				"date":              time.Now().Add(-time.Hour).UTC().Format(time.RFC3339),
				"hours_at":          -5,
			}
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f, h := newMeterFixture(t)
			id := seedHourEquipmentWithoutReading(t, f)
			taskID := seedTask(t, h, id)

			f.expectNegativeRejected(f.do(http.MethodPost, "/interventions", tc.body(id, taskID)), "log intervention")

			if list := listInterventions(t, f); len(list) != 0 {
				t.Errorf("%d interventions stored, want none", len(list))
			}
			assertNoReading(t, f.equipment(id))
		})
	}
}

func TestEditIntervention_NegativeReadingRejected(t *testing.T) {
	f, h := newMeterFixture(t)
	id := seedHourEquipmentWithoutReading(t, f)
	taskID := seedTask(t, h, id)
	invID := f.createdID(f.do(http.MethodPost, "/interventions", interventionBody(taskID, 100)), "log intervention")
	before := f.equipment(id)

	f.expectNegativeRejected(f.do(http.MethodPut, "/interventions/"+itoa(invID), interventionBody(taskID, -5)), "edit intervention")

	rec := f.do(http.MethodGet, "/interventions/"+itoa(invID), nil)
	f.expect(rec, http.StatusOK, "get intervention")
	var inv models.Intervention
	if err := json.Unmarshal(rec.Body.Bytes(), &inv); err != nil {
		t.Fatalf("decode intervention: %v", err)
	}
	if inv.HoursAt == nil || *inv.HoursAt != 100 {
		t.Errorf("hours_at = %v, want unchanged 100", fmtHours(inv.HoursAt))
	}
	after := f.equipment(id)
	assertReading(t, after, 100)
	assertFreshnessUnchanged(t, before, after)
}

func TestCreateEquipment_NegativeReadingRejected(t *testing.T) {
	f, _ := newMeterFixture(t)

	body := map[string]any{"name": "Engine", "tracks_hours": true, "hours": -5}
	f.expectNegativeRejected(f.do(http.MethodPost, "/equipments", body), "create equipment")

	rec := f.do(http.MethodGet, "/equipments", nil)
	f.expect(rec, http.StatusOK, "list equipments")
	var list []models.Equipment
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode equipments: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("%d equipments stored, want none", len(list))
	}
}

func TestTurnHourMeterOn_NegativeReadingRejected(t *testing.T) {
	f, h := newMeterFixture(t)
	id := seedEquipment(t, h) // tracks_hours = false, no reading

	body := map[string]any{"name": "Engine", "tracks_hours": true, "hours": -5}
	f.expectNegativeRejected(f.do(http.MethodPut, "/equipments/"+itoa(id), body), "turn on")

	eq := f.equipment(id)
	if eq.TracksHours {
		t.Errorf("tracks_hours = true after a rejected request, want false")
	}
	assertNoReading(t, eq)
}

func TestConfirmReading_NegativeReadingRejected(t *testing.T) {
	f, _ := newMeterFixture(t)
	id := seedHourEquipmentWithoutReading(t, f)

	f.expectNegativeRejected(f.do(http.MethodPut, "/equipments/"+itoa(id)+"/hours", map[string]any{"hours": -5}), "update hours")

	assertNoReading(t, f.equipment(id))
}

func listEquipments(t *testing.T, f *meterFixture) []models.Equipment {
	t.Helper()
	rec := f.do(http.MethodGet, "/equipments", nil)
	f.expect(rec, http.StatusOK, "list equipments")
	var list []models.Equipment
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode equipments: %v", err)
	}
	return list
}

// A negative hours is refused even where the server would ignore it.
func TestCreateEquipment_IgnoredNegativeReadingRejected(t *testing.T) {
	f, _ := newMeterFixture(t)

	body := map[string]any{"name": "Dinghy", "tracks_hours": false, "hours": -5}
	f.expectNegativeRejected(f.do(http.MethodPost, "/equipments", body), "create equipment without hour-meter")

	if list := listEquipments(t, f); len(list) != 0 {
		t.Errorf("%d equipments stored, want none", len(list))
	}
}

func TestEditEquipment_IgnoredNegativeReadingRejected(t *testing.T) {
	cases := []struct {
		name        string
		tracksHours bool // in the request; the equipment already tracks hours
	}{
		{"hour-meter stays on", true},
		{"hour-meter turned off", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f, h := newMeterFixture(t)
			id := seedHourEquipment(t, h, 100, 30*24*time.Hour)
			before := f.equipment(id)

			body := map[string]any{"name": "Renamed", "tracks_hours": tc.tracksHours, "hours": -5}
			f.expectNegativeRejected(f.do(http.MethodPut, "/equipments/"+itoa(id), body), "edit equipment")

			after := f.equipment(id)
			if after.Name != before.Name || !after.TracksHours {
				t.Errorf("equipment changed by a rejected request: name %q, tracks_hours %v", after.Name, after.TracksHours)
			}
			assertReading(t, after, 100)
			assertFreshnessUnchanged(t, before, after)
		})
	}
}

func TestEditEquipment_NonTrackingIgnoredNegativeReadingRejected(t *testing.T) {
	f, h := newMeterFixture(t)
	id := seedEquipment(t, h) // tracks_hours = false, stays off

	body := map[string]any{"name": "Renamed", "tracks_hours": false, "hours": -5}
	f.expectNegativeRejected(f.do(http.MethodPut, "/equipments/"+itoa(id), body), "edit equipment")

	eq := f.equipment(id)
	if eq.Name == "Renamed" {
		t.Errorf("name changed by a rejected request")
	}
	assertNoReading(t, eq)
}
