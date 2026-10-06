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

// commissionedToday is a commissioned_at of today: the months rule counts from
// it, since these equipments have no intervention. Without a baseline date the
// months rule has no amount (#62).
func commissionedToday() *string {
	d := time.Now().UTC().Format("2006-01-02")
	return &d
}

// Issue #67: the Due status returned by the API says which trigger drives it
// (due_trigger) and by how much (due_in_days, due_in_hours). The rules are
// pinned against a fixed clock in internal/logic; these tests check the JSON
// the client reads.

func createTaskJSON(t *testing.T, e *echo.Echo, body map[string]any) map[string]any {
	t.Helper()
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", bytes.NewReader(raw))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create task: expected 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	var task map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &task); err != nil {
		t.Fatalf("decode task: %v", err)
	}
	return task
}

func seedEquipmentWith(t *testing.T, h *handlers.Handler, eq *models.Equipment) int {
	t.Helper()
	if err := db.CreateEquipment(h.DB, eq); err != nil {
		t.Fatalf("CreateEquipment: %v", err)
	}
	return eq.ID
}

// The absorbed bug's case: overdue by hours while the calendar due date is two
// years ahead. The trigger says hours, so no client has to guess.
func TestTaskDueStatus_OverdueByHoursWithFutureDate(t *testing.T) {
	e, h, _ := newTestServer(t)
	hours := 1000.0
	id := seedEquipmentWith(t, h, &models.Equipment{Name: "Engine", TracksHours: true, Hours: &hours, CommissionedAt: commissionedToday()})

	task := createTaskJSON(t, e, map[string]any{"equipment_id": id, "name": "Oil change", "hours_interval": 500, "months_interval": 24})

	if task["due_status"] != "overdue" {
		t.Errorf("due_status = %v, want overdue", task["due_status"])
	}
	if task["due_trigger"] != "hours" {
		t.Errorf("due_trigger = %v, want hours", task["due_trigger"])
	}
	if task["due_in_hours"] != -500.0 {
		t.Errorf("due_in_hours = %v, want -500", task["due_in_hours"])
	}
	// Both amounts are returned: the months rule also applies, about two
	// years ahead.
	if days, ok := task["due_in_days"].(float64); !ok || days < 700 {
		t.Errorf("due_in_days = %v, want about 730", task["due_in_days"])
	}
}

func TestTaskDueStatus_MonthsOnlyHasNoHourAmount(t *testing.T) {
	e, h, _ := newTestServer(t)
	id := seedEquipmentWith(t, h, &models.Equipment{Name: "Car", CommissionedAt: commissionedToday()})

	task := createTaskJSON(t, e, map[string]any{"equipment_id": id, "name": "Service", "months_interval": 6})

	if task["due_status"] != "ok" {
		t.Errorf("due_status = %v, want ok", task["due_status"])
	}
	if task["due_trigger"] != "months" {
		t.Errorf("due_trigger = %v, want months", task["due_trigger"])
	}
	if days, ok := task["due_in_days"].(float64); !ok || days < 180 || days > 185 {
		t.Errorf("due_in_days = %v, want about 182", task["due_in_days"])
	}
	if _, present := task["due_in_hours"]; present {
		t.Errorf("due_in_hours = %v, want absent", task["due_in_hours"])
	}
}

// Never performed and no commissioning date: the months rule is overdue but
// has no amount, so due_in_days (and next_due_date) are absent, not zero.
func TestTaskDueStatus_MonthsNoBaselineIsOverdueWithoutAmount(t *testing.T) {
	e, h, _ := newTestServer(t)
	id := seedEquipmentWith(t, h, &models.Equipment{Name: "Car"})

	task := createTaskJSON(t, e, map[string]any{"equipment_id": id, "name": "Service", "months_interval": 6})

	if task["due_status"] != "overdue" {
		t.Errorf("due_status = %v, want overdue", task["due_status"])
	}
	if task["due_trigger"] != "months" {
		t.Errorf("due_trigger = %v, want months", task["due_trigger"])
	}
	for _, field := range []string{"next_due_date", "due_in_days", "due_in_hours"} {
		if v, present := task[field]; present {
			t.Errorf("%s = %v, want absent", field, v)
		}
	}
}

// Same equipment, but the hours rule is overdue too: it has a concrete amount,
// so it drives.
func TestTaskDueStatus_MonthsNoBaselineYieldsToOverdueHours(t *testing.T) {
	e, h, _ := newTestServer(t)
	hours := 1000.0
	id := seedEquipmentWith(t, h, &models.Equipment{Name: "Engine", TracksHours: true, Hours: &hours})

	task := createTaskJSON(t, e, map[string]any{"equipment_id": id, "name": "Oil change", "hours_interval": 500, "months_interval": 6})

	if task["due_status"] != "overdue" {
		t.Errorf("due_status = %v, want overdue", task["due_status"])
	}
	if task["due_trigger"] != "hours" {
		t.Errorf("due_trigger = %v, want hours", task["due_trigger"])
	}
	if task["due_in_hours"] != -500.0 {
		t.Errorf("due_in_hours = %v, want -500", task["due_in_hours"])
	}
	if v, present := task["due_in_days"]; present {
		t.Errorf("due_in_days = %v, want absent", v)
	}
}

// Due today: due_in_days is 0 and must still be in the JSON, not dropped as
// an empty value.
func TestTaskDueStatus_DueTodayKeepsZeroDays(t *testing.T) {
	e, h, _ := newTestServer(t)
	today := time.Now().UTC()
	commissioned := today.AddDate(-1, 0, 0)
	if commissioned.AddDate(1, 0, 0).Format("2006-01-02") != today.Format("2006-01-02") {
		t.Skip("today is Feb 29: no date a year earlier lands on it")
	}
	date := commissioned.Format("2006-01-02")
	id := seedEquipmentWith(t, h, &models.Equipment{Name: "Boiler", CommissionedAt: &date})

	task := createTaskJSON(t, e, map[string]any{"equipment_id": id, "name": "Inspection", "months_interval": 12})

	if task["next_due_date"] != today.Format("2006-01-02") {
		t.Fatalf("next_due_date = %v, want %s", task["next_due_date"], today.Format("2006-01-02"))
	}
	if task["due_trigger"] != "months" {
		t.Errorf("due_trigger = %v, want months", task["due_trigger"])
	}
	if days, ok := task["due_in_days"]; !ok || days != 0.0 {
		t.Errorf("due_in_days = %v (present: %v), want 0", days, ok)
	}
}

// Issue #68: urgency, the fraction of the interval elapsed, ranks tasks across
// triggers. The equipment has 300 h on the meter and has been in service for
// 13 months, nothing ever performed.
func TestTaskDueStatus_UrgencyRanksAcrossTriggers(t *testing.T) {
	e, h, _ := newTestServer(t)
	hours := 300.0
	commissioned := time.Now().UTC().AddDate(0, -13, 0).Format("2006-01-02")
	id := seedEquipmentWith(t, h, &models.Equipment{Name: "Engine", TracksHours: true, Hours: &hours, CommissionedAt: &commissioned})

	// Overdue by 200 h on a 100 h interval, calendar due date 11 months ahead.
	byHours := createTaskJSON(t, e, map[string]any{"equipment_id": id, "name": "Oil change", "hours_interval": 100, "months_interval": 24})
	// Overdue by about a month on a 12-month interval.
	byMonths := createTaskJSON(t, e, map[string]any{"equipment_id": id, "name": "Inspection", "months_interval": 12})

	for _, task := range []map[string]any{byHours, byMonths} {
		if task["due_status"] != "overdue" {
			t.Errorf("%v: due_status = %v, want overdue", task["name"], task["due_status"])
		}
	}
	if byHours["due_trigger"] != "hours" {
		t.Errorf("due_trigger = %v, want hours", byHours["due_trigger"])
	}
	if byHours["urgency"] != 3.0 {
		t.Errorf("hours task urgency = %v, want 3 (300 h elapsed of 100 h)", byHours["urgency"])
	}
	monthsUrgency, ok := byMonths["urgency"].(float64)
	if !ok || monthsUrgency <= 1 || monthsUrgency >= 1.1 {
		t.Errorf("months task urgency = %v, want about 13/12", byMonths["urgency"])
	}
}

// A task just done is at 0: the urgency must still be in the JSON, not
// dropped as an empty value.
func TestTaskDueStatus_ZeroUrgencyIsKept(t *testing.T) {
	e, h, _ := newTestServer(t)
	hours := 0.0
	id := seedEquipmentWith(t, h, &models.Equipment{Name: "Generator", TracksHours: true, Hours: &hours})

	task := createTaskJSON(t, e, map[string]any{"equipment_id": id, "name": "Oil change", "hours_interval": 100})

	if urgency, ok := task["urgency"]; !ok || urgency != 0.0 {
		t.Errorf("urgency = %v (present: %v), want 0", urgency, ok)
	}
}

// No rule applies (the meter has no reading yet): no urgency.
func TestTaskDueStatus_NoRuleNoUrgency(t *testing.T) {
	e, h, _ := newTestServer(t)
	id := seedEquipmentWith(t, h, &models.Equipment{Name: "Pump", TracksHours: true})

	task := createTaskJSON(t, e, map[string]any{"equipment_id": id, "name": "Seal check", "hours_interval": 100})

	if _, present := task["due_trigger"]; present {
		t.Errorf("due_trigger = %v, want absent", task["due_trigger"])
	}
	if _, present := task["urgency"]; present {
		t.Errorf("urgency = %v, want absent", task["urgency"])
	}
}

// A months rule with no date baseline (#62) has no fraction: months-only gives
// no urgency, and with an hours rule the urgency is the hours rule's alone.
func TestTaskDueStatus_MonthsNoBaselineHasNoUrgency(t *testing.T) {
	e, h, _ := newTestServer(t)
	hours := 150.0
	id := seedEquipmentWith(t, h, &models.Equipment{Name: "Engine", TracksHours: true, Hours: &hours})

	monthsOnly := createTaskJSON(t, e, map[string]any{"equipment_id": id, "name": "Inspection", "months_interval": 12})
	if monthsOnly["due_status"] != "overdue" {
		t.Errorf("due_status = %v, want overdue", monthsOnly["due_status"])
	}
	if v, present := monthsOnly["urgency"]; present {
		t.Errorf("months-only urgency = %v, want absent", v)
	}

	both := createTaskJSON(t, e, map[string]any{"equipment_id": id, "name": "Oil change", "hours_interval": 100, "months_interval": 12})
	if both["urgency"] != 1.5 {
		t.Errorf("urgency = %v, want 1.5 (150 h elapsed of 100 h, hours rule only)", both["urgency"])
	}
}
