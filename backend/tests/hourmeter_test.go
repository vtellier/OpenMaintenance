package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/handlers"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

// meterFixture drives the hour-meter paths (doc/data-model.md, "Hour-meter
// behavior") through the HTTP API and reads the result back the same way.
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
