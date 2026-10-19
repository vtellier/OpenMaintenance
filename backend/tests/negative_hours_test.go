package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

// Issue #102: a negative hour-meter reading was accepted on every path that
// takes one. Each path must answer 400 with a reason and store nothing.

// expectNegativeRejected fails unless rec is a 400 whose error names the
// negative reading.
func (f *meterFixture) expectNegativeRejected(rec *httptest.ResponseRecorder, what string) {
	f.t.Helper()
	f.expect(rec, http.StatusBadRequest, what)
	var body struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		f.t.Fatalf("%s: decode error body: %v (%s)", what, err, rec.Body.String())
	}
	if !strings.Contains(body.Error, "negative") {
		f.t.Errorf("%s: error = %q, want a reason saying the reading cannot be negative", what, body.Error)
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
