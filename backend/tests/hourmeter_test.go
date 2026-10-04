package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/handlers"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

// meterFixture drives the hour-meter paths (doc/data-model.md, "What changes
// the reading") through the HTTP API and reads the result back the same way.
type meterFixture struct {
	t *testing.T
	e *echo.Echo
}

// newMeterFixture starts a test server; the handler is returned for seeding.
func newMeterFixture(t *testing.T) (*meterFixture, *handlers.Handler) {
	t.Helper()
	e, h, _ := newTestServer(t)
	return &meterFixture{t: t, e: e}, h
}

// do sends a JSON request to /api+path.
func (f *meterFixture) do(method, path string, body any) *httptest.ResponseRecorder {
	f.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			f.t.Fatalf("encode body: %v", err)
		}
	}
	req := httptest.NewRequest(method, "/api"+path, &buf)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	f.e.ServeHTTP(rec, req)
	return rec
}

// expect fails the test unless the response has the wanted status code.
func (f *meterFixture) expect(rec *httptest.ResponseRecorder, want int, what string) {
	f.t.Helper()
	if rec.Code != want {
		f.t.Fatalf("%s: expected %d, got %d (%s)", what, want, rec.Code, rec.Body.String())
	}
}

// equipment reads an equipment through GET /equipments/{id}.
func (f *meterFixture) equipment(id int) models.Equipment {
	f.t.Helper()
	rec := f.do(http.MethodGet, "/equipments/"+itoa(id), nil)
	f.expect(rec, http.StatusOK, "get equipment")
	var eq models.Equipment
	if err := json.Unmarshal(rec.Body.Bytes(), &eq); err != nil {
		f.t.Fatalf("decode equipment: %v", err)
	}
	return eq
}

// assertReading fails unless the equipment's reading is want.
func assertReading(t *testing.T, eq models.Equipment, want float64) {
	t.Helper()
	if eq.Hours == nil || *eq.Hours != want {
		t.Errorf("hours = %v, want %v", fmtHours(eq.Hours), want)
	}
}

// assertFreshnessUnchanged fails unless hours_updated_at is the same as before.
func assertFreshnessUnchanged(t *testing.T, before, after models.Equipment) {
	t.Helper()
	switch {
	case before.HoursUpdatedAt == nil && after.HoursUpdatedAt == nil:
	case before.HoursUpdatedAt == nil || after.HoursUpdatedAt == nil ||
		!after.HoursUpdatedAt.Equal(*before.HoursUpdatedAt):
		t.Errorf("hours_updated_at = %v, want unchanged %v", after.HoursUpdatedAt, before.HoursUpdatedAt)
	}
}

func fmtHours(h *float64) any {
	if h == nil {
		return "<nil>"
	}
	return *h
}

// Issue #69 (absorbed bug): editing equipment metadata reset the hour-meter
// freshness to "never". Every metadata edit, including the icon picker on the
// detail header (which re-sends the whole equipment), must leave the reading
// and its freshness untouched.
func TestEditEquipmentMetadata_KeepsReadingAndFreshness(t *testing.T) {
	cases := []struct {
		name string
		body map[string]any
	}{
		{"rename", map[string]any{"name": "Main engine", "tracks_hours": true, "hours": 100}},
		{"description", map[string]any{"name": "Engine", "description": "Port side", "tracks_hours": true, "hours": 100}},
		{"commissioning date", map[string]any{"name": "Engine", "commissioned_at": "2020-06-01", "tracks_hours": true, "hours": 100}},
		{"icon from the detail header", map[string]any{"name": "Engine", "icon": "⛵", "tracks_hours": true, "hours": 100}},
		{"hours omitted", map[string]any{"name": "Main engine", "tracks_hours": true}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f, h := newMeterFixture(t)
			id := seedHourEquipment(t, h, 100, 72*time.Hour)
			before := f.equipment(id)

			f.expect(f.do(http.MethodPut, "/equipments/"+itoa(id), tc.body), http.StatusOK, "metadata edit")

			after := f.equipment(id)
			assertReading(t, after, 100)
			assertFreshnessUnchanged(t, before, after)
		})
	}
}

// Issue #69 (absorbed bug): a metadata edit accepted a lower reading
// (100 → 10). The hours field of a metadata edit is ignored, so the reading
// cannot go backwards through it.
func TestEditEquipmentMetadata_CannotLowerReading(t *testing.T) {
	f, h := newMeterFixture(t)
	id := seedHourEquipment(t, h, 100, 72*time.Hour)
	before := f.equipment(id)

	body := map[string]any{"name": "Engine", "tracks_hours": true, "hours": 10}
	f.expect(f.do(http.MethodPut, "/equipments/"+itoa(id), body), http.StatusOK, "metadata edit")

	after := f.equipment(id)
	assertReading(t, after, 100)
	assertFreshnessUnchanged(t, before, after)
}

// assertFresh fails unless hours_updated_at was just set to now.
func assertFresh(t *testing.T, eq models.Equipment) {
	t.Helper()
	if eq.HoursUpdatedAt == nil || time.Since(*eq.HoursUpdatedAt) > time.Minute {
		t.Errorf("hours_updated_at = %v, want now", eq.HoursUpdatedAt)
	}
}

// assertNoReading fails unless the equipment has no reading at all.
func assertNoReading(t *testing.T, eq models.Equipment) {
	t.Helper()
	if eq.Hours != nil || eq.HoursUpdatedAt != nil {
		t.Errorf("hours = %v, hours_updated_at = %v, want no reading", fmtHours(eq.Hours), eq.HoursUpdatedAt)
	}
}

// createdID decodes the id of the resource a POST created.
func (f *meterFixture) createdID(rec *httptest.ResponseRecorder, what string) int {
	f.t.Helper()
	f.expect(rec, http.StatusCreated, what)
	var created struct {
		ID int `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		f.t.Fatalf("decode %s: %v", what, err)
	}
	return created.ID
}

// interventionBody is a standard intervention on taskID, performed an hour ago.
func interventionBody(taskID int, hoursAt float64) map[string]any {
	return map[string]any{
		"task_id":  taskID,
		"date":     time.Now().Add(-time.Hour).UTC().Format(time.RFC3339),
		"hours_at": hoursAt,
	}
}

// ── Create ──

func TestCreateEquipment_InitialReadingIsFresh(t *testing.T) {
	f, _ := newMeterFixture(t)

	body := map[string]any{"name": "Engine", "tracks_hours": true, "hours": 50}
	id := f.createdID(f.do(http.MethodPost, "/equipments", body), "create")

	eq := f.equipment(id)
	assertReading(t, eq, 50)
	assertFresh(t, eq)
}

func TestCreateEquipment_NoReadingRecorded(t *testing.T) {
	cases := []struct {
		name string
		body map[string]any
	}{
		{"hour-meter on, no hours entered", map[string]any{"name": "Engine", "tracks_hours": true}},
		{"hour-meter off, hours ignored", map[string]any{"name": "Car", "tracks_hours": false, "hours": 50}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f, _ := newMeterFixture(t)
			id := f.createdID(f.do(http.MethodPost, "/equipments", tc.body), "create")
			assertNoReading(t, f.equipment(id))
		})
	}
}

// ── Metadata edit ──

func TestEditEquipmentMetadata_UnknownEquipment(t *testing.T) {
	f, _ := newMeterFixture(t)
	body := map[string]any{"name": "Ghost", "tracks_hours": true, "hours": 10}
	f.expect(f.do(http.MethodPut, "/equipments/9999", body), http.StatusNotFound, "edit unknown equipment")
}

// ── Hour-meter toggle ──

func TestTurnHourMeterOn_RecordsInitialReading(t *testing.T) {
	f, h := newMeterFixture(t)
	id := seedEquipment(t, h) // tracks_hours = false, no reading

	body := map[string]any{"name": "Engine", "tracks_hours": true, "hours": 30}
	f.expect(f.do(http.MethodPut, "/equipments/"+itoa(id), body), http.StatusOK, "turn on")

	eq := f.equipment(id)
	if !eq.TracksHours {
		t.Fatalf("tracks_hours = false, want true")
	}
	assertReading(t, eq, 30)
	assertFresh(t, eq)
}

func TestTurnHourMeterOn_WithoutHoursRecordsNothing(t *testing.T) {
	f, h := newMeterFixture(t)
	id := seedEquipment(t, h)

	body := map[string]any{"name": "Engine", "tracks_hours": true}
	f.expect(f.do(http.MethodPut, "/equipments/"+itoa(id), body), http.StatusOK, "turn on")

	eq := f.equipment(id)
	if !eq.TracksHours {
		t.Fatalf("tracks_hours = false, want true")
	}
	assertNoReading(t, eq)
}

func TestTurnHourMeterOff_KeepsReading(t *testing.T) {
	f, h := newMeterFixture(t)
	id := seedHourEquipment(t, h, 100, 72*time.Hour)
	before := f.equipment(id)

	body := map[string]any{"name": "Engine", "tracks_hours": false}
	f.expect(f.do(http.MethodPut, "/equipments/"+itoa(id), body), http.StatusOK, "turn off")

	after := f.equipment(id)
	if after.TracksHours {
		t.Fatalf("tracks_hours = true, want false")
	}
	assertReading(t, after, 100)
	assertFreshnessUnchanged(t, before, after)
}

// Turning the hour-meter back on cannot lower the reading kept while it was off.
func TestTurnHourMeterBackOn(t *testing.T) {
	cases := []struct {
		name       string
		initial    float64
		wantStatus int
		wantHours  float64
	}{
		{"lower reading rejected", 10, http.StatusBadRequest, 100},
		{"same reading confirmed", 100, http.StatusOK, 100},
		{"higher reading recorded", 120, http.StatusOK, 120},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f, h := newMeterFixture(t)
			id := seedHourEquipment(t, h, 100, 72*time.Hour)
			off := map[string]any{"name": "Engine", "tracks_hours": false}
			f.expect(f.do(http.MethodPut, "/equipments/"+itoa(id), off), http.StatusOK, "turn off")
			before := f.equipment(id)

			on := map[string]any{"name": "Engine", "tracks_hours": true, "hours": tc.initial}
			f.expect(f.do(http.MethodPut, "/equipments/"+itoa(id), on), tc.wantStatus, "turn back on")

			after := f.equipment(id)
			assertReading(t, after, tc.wantHours)
			if tc.wantStatus != http.StatusOK {
				// A rejected request changes nothing, not even tracks_hours.
				if after.TracksHours {
					t.Errorf("tracks_hours = true after a rejected request, want false")
				}
				assertFreshnessUnchanged(t, before, after)
				return
			}
			if !after.TracksHours {
				t.Errorf("tracks_hours = false, want true")
			}
			assertFresh(t, after)
		})
	}
}

// ── Update hours / Same hours ──

// "Update hours" and the Dashboard's "Same hours" both submit an explicit
// reading: it refreshes freshness even when unchanged, and cannot go back.
func TestConfirmReading(t *testing.T) {
	cases := []struct {
		name       string
		hours      float64
		wantStatus int
		wantHours  float64
		wantFresh  bool
	}{
		{"Update hours with a higher reading", 150, http.StatusOK, 150, true},
		{"Same hours", 100, http.StatusOK, 100, true},
		{"lower reading rejected", 50, http.StatusBadRequest, 100, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f, h := newMeterFixture(t)
			id := seedHourEquipment(t, h, 100, 72*time.Hour)
			before := f.equipment(id)

			body := map[string]any{"hours": tc.hours}
			f.expect(f.do(http.MethodPut, "/equipments/"+itoa(id)+"/hours", body), tc.wantStatus, "confirm reading")

			after := f.equipment(id)
			assertReading(t, after, tc.wantHours)
			if tc.wantFresh {
				assertFresh(t, after)
			} else {
				assertFreshnessUnchanged(t, before, after)
			}
		})
	}
}

// ── Interventions ──

// Logging an intervention raises the reading, and refreshes its freshness,
// only when hours_at is strictly greater than the current reading.
func TestLogIntervention_Reading(t *testing.T) {
	cases := []struct {
		name      string
		hoursAt   float64
		wantHours float64
		wantFresh bool
	}{
		{"higher reading raises it", 150, 150, true},
		{"equal reading changes nothing", 100, 100, false},
		{"lower reading changes nothing", 80, 100, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f, h := newMeterFixture(t)
			id := seedHourEquipment(t, h, 100, 72*time.Hour)
			taskID := seedTask(t, h, id)
			before := f.equipment(id)

			f.createdID(f.do(http.MethodPost, "/interventions", interventionBody(taskID, tc.hoursAt)), "log intervention")

			after := f.equipment(id)
			assertReading(t, after, tc.wantHours)
			if tc.wantFresh {
				assertFresh(t, after)
			} else {
				assertFreshnessUnchanged(t, before, after)
			}
		})
	}
}

func TestLogExceptionalIntervention_RaisesReading(t *testing.T) {
	f, h := newMeterFixture(t)
	id := seedHourEquipment(t, h, 100, 72*time.Hour)

	body := map[string]any{
		"equipment_id":      id,
		"exceptional_label": "Replaced impeller",
		"date":              time.Now().Add(-time.Hour).UTC().Format(time.RFC3339),
		"hours_at":          130,
	}
	f.createdID(f.do(http.MethodPost, "/interventions", body), "log exceptional intervention")

	eq := f.equipment(id)
	assertReading(t, eq, 130)
	assertFresh(t, eq)
}

func TestLogIntervention_NonTrackingEquipmentKeepsNoReading(t *testing.T) {
	f, h := newMeterFixture(t)
	id := seedEquipment(t, h) // tracks_hours = false
	taskID := seedTask(t, h, id)

	f.createdID(f.do(http.MethodPost, "/interventions", interventionBody(taskID, 150)), "log intervention")

	assertNoReading(t, f.equipment(id))
}

// Editing an intervention applies the same rule as logging one. Whether an
// edit (or a delete) may lower the reading is not decided yet (#70): today it
// never does.
func TestEditIntervention_Reading(t *testing.T) {
	f, h := newMeterFixture(t)
	id := seedHourEquipment(t, h, 100, 72*time.Hour)
	taskID := seedTask(t, h, id)
	invID := f.createdID(f.do(http.MethodPost, "/interventions", interventionBody(taskID, 100)), "log intervention")
	logged := f.equipment(id)

	f.expect(f.do(http.MethodPut, "/interventions/"+itoa(invID), interventionBody(taskID, 150)), http.StatusOK, "edit to a higher reading")
	raised := f.equipment(id)
	assertReading(t, raised, 150)
	assertFresh(t, raised)
	if raised.HoursUpdatedAt != nil && !raised.HoursUpdatedAt.After(*logged.HoursUpdatedAt) {
		t.Errorf("hours_updated_at not refreshed: %v, before %v", raised.HoursUpdatedAt, logged.HoursUpdatedAt)
	}

	f.expect(f.do(http.MethodPut, "/interventions/"+itoa(invID), interventionBody(taskID, 120)), http.StatusOK, "edit to a lower reading")
	after := f.equipment(id)
	assertReading(t, after, 150)
	assertFreshnessUnchanged(t, raised, after)
}

// ── Concurrent requests ──

// The write itself refuses to lower the stored reading, so a request that read
// the reading before another one raised it cannot move the meter back.
func TestSetEquipmentHours_NeverLowersStoredReading(t *testing.T) {
	f, h := newMeterFixture(t)
	id := seedHourEquipment(t, h, 100, 72*time.Hour)
	before := f.equipment(id)

	written, err := db.SetEquipmentHours(h.DB, id, 50, time.Now())
	if err != nil {
		t.Fatalf("SetEquipmentHours: %v", err)
	}
	if written {
		t.Errorf("SetEquipmentHours wrote a lower reading")
	}

	after := f.equipment(id)
	assertReading(t, after, 100)
	assertFreshnessUnchanged(t, before, after)
}
