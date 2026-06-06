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

// seedHourEquipment creates an hour-tracked equipment whose hour-meter was last
// updated `staleFor` ago, so freshness behaviour can be asserted.
func seedHourEquipment(t *testing.T, h *handlers.Handler, hours float64, staleFor time.Duration) int {
	t.Helper()
	updated := time.Now().Add(-staleFor)
	eq := &models.Equipment{
		Name:           "Engine",
		TracksHours:    true,
		Hours:          &hours,
		HoursUpdatedAt: &updated,
	}
	if err := db.CreateEquipment(h.DB, eq); err != nil {
		t.Fatalf("CreateEquipment: %v", err)
	}
	return eq.ID
}

func putHours(t *testing.T, e *echo.Echo, id int, hours float64) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]float64{"hours": hours})
	req := httptest.NewRequest(http.MethodPut, "/api/equipments/"+itoa(id)+"/hours", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// Issue #16: confirming the *same* hour-meter value must refresh the freshness
// timestamp so the Dashboard reminder can be dismissed.
func TestUpdateEquipmentHours_SameValueRefreshesTimestamp(t *testing.T) {
	e, h, _ := newTestServer(t)
	id := seedHourEquipment(t, h, 100, 30*24*time.Hour) // 30 days stale

	before, _ := db.GetEquipment(h.DB, id)

	rec := putHours(t, e, id, 100) // identical value
	if rec.Code != http.StatusOK {
		t.Fatalf("same-value update: expected 200, got %d (%s)", rec.Code, rec.Body.String())
	}

	after, _ := db.GetEquipment(h.DB, id)
	if after.Hours == nil || *after.Hours != 100 {
		t.Fatalf("hours = %v, want 100", after.Hours)
	}
	if after.HoursUpdatedAt == nil || !after.HoursUpdatedAt.After(*before.HoursUpdatedAt) {
		t.Errorf("hours_updated_at was not refreshed: before=%v after=%v", before.HoursUpdatedAt, after.HoursUpdatedAt)
	}
	if time.Since(*after.HoursUpdatedAt) > time.Minute {
		t.Errorf("hours_updated_at not close to now: %v", after.HoursUpdatedAt)
	}
}

func TestUpdateEquipmentHours_HigherValueAccepted(t *testing.T) {
	e, h, _ := newTestServer(t)
	id := seedHourEquipment(t, h, 100, time.Hour)

	rec := putHours(t, e, id, 150)
	if rec.Code != http.StatusOK {
		t.Fatalf("higher update: expected 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	after, _ := db.GetEquipment(h.DB, id)
	if after.Hours == nil || *after.Hours != 150 {
		t.Errorf("hours = %v, want 150", after.Hours)
	}
}

func TestUpdateEquipmentHours_LowerValueRejected(t *testing.T) {
	e, h, _ := newTestServer(t)
	id := seedHourEquipment(t, h, 100, time.Hour)

	rec := putHours(t, e, id, 50)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("lower update: expected 400, got %d (%s)", rec.Code, rec.Body.String())
	}
	after, _ := db.GetEquipment(h.DB, id)
	if after.Hours == nil || *after.Hours != 100 {
		t.Errorf("hours changed to %v, want unchanged 100", after.Hours)
	}
}

func TestUpdateEquipmentHours_NonTrackingRejected(t *testing.T) {
	e, h, _ := newTestServer(t)
	id := seedEquipment(t, h) // tracks_hours = false

	rec := putHours(t, e, id, 10)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("non-tracking update: expected 400, got %d (%s)", rec.Code, rec.Body.String())
	}
}

func TestUpdateEquipmentHours_NotFound(t *testing.T) {
	e, _, _ := newTestServer(t)

	rec := putHours(t, e, 9999, 10)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("missing equipment: expected 404, got %d (%s)", rec.Code, rec.Body.String())
	}
}
