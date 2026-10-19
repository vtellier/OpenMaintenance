package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
)

// Issue #99: expiry tasks, due on the expiry date of the part fitted. The
// rules are pinned against a fixed clock in internal/logic; these tests check
// the API contract: what is accepted, what is rejected, and the JSON the
// client reads.

// send makes a JSON request and returns the recorder.
func send(t *testing.T, e *echo.Echo, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		reader = bytes.NewReader(raw)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// expectJSON checks the status code and decodes the body.
func expectJSON(t *testing.T, rec *httptest.ResponseRecorder, want int, what string) map[string]any {
	t.Helper()
	if rec.Code != want {
		t.Fatalf("%s: expected %d, got %d (%s)", what, want, rec.Code, rec.Body.String())
	}
	var out map[string]any
	if rec.Body.Len() > 0 {
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
			t.Fatalf("%s: decode: %v", what, err)
		}
	}
	return out
}

// day is today's date shifted by n days, YYYY-MM-DD, in UTC like the due
// status.
func day(n int) string {
	return time.Now().UTC().AddDate(0, 0, n).Format("2006-01-02")
}

func taskPath(id any) string {
	return "/api/tasks/" + itoa(int(id.(float64)))
}

func TestExpiryTask_CreateWithCurrentExpiryDate(t *testing.T) {
	e, h, _ := newTestServer(t)
	eqID := seedEquipment(t, h)

	task := expectJSON(t, send(t, e, http.MethodPost, "/api/tasks", map[string]any{
		"equipment_id": eqID, "name": "Replace CO2 cartridge", "kind": "expiry", "current_expiry_date": day(12),
	}), http.StatusCreated, "create")

	want := map[string]any{
		"kind": "expiry", "current_expiry_date": day(12), "next_due_date": day(12),
		"due_status": "due_soon", "due_trigger": "expiry", "due_in_days": 12.0,
	}
	for k, v := range want {
		if task[k] != v {
			t.Errorf("%s = %v, want %v", k, task[k], v)
		}
	}
	// Nothing fitted yet: no date fitted to measure from.
	if _, ok := task["urgency"]; ok {
		t.Errorf("urgency = %v, want absent", task["urgency"])
	}
	for _, k := range []string{"hours_interval", "months_interval", "next_due_hours", "due_in_hours"} {
		if _, ok := task[k]; ok {
			t.Errorf("%s = %v, want absent", k, task[k])
		}
	}

	got := expectJSON(t, send(t, e, http.MethodGet, taskPath(task["id"]), nil), http.StatusOK, "get")
	if got["kind"] != "expiry" || got["current_expiry_date"] != day(12) {
		t.Errorf("stored kind = %v, current_expiry_date = %v", got["kind"], got["current_expiry_date"])
	}
}

func TestExpiryTask_WithoutCurrentExpiryDateIsOverdueWithNoDate(t *testing.T) {
	e, h, _ := newTestServer(t)
	eqID := seedEquipment(t, h)

	task := expectJSON(t, send(t, e, http.MethodPost, "/api/tasks", map[string]any{
		"equipment_id": eqID, "name": "Replace CO2 cartridge", "kind": "expiry",
	}), http.StatusCreated, "create")

	if task["due_status"] != "overdue" || task["due_trigger"] != "expiry" {
		t.Errorf("due_status = %v, due_trigger = %v, want overdue, expiry", task["due_status"], task["due_trigger"])
	}
	for _, k := range []string{"next_due_date", "due_in_days", "urgency", "current_expiry_date"} {
		if _, ok := task[k]; ok {
			t.Errorf("%s = %v, want absent", k, task[k])
		}
	}
}

func TestTask_KindDefaultsToInterval(t *testing.T) {
	e, h, _ := newTestServer(t)
	eqID := seedEquipment(t, h)

	task := expectJSON(t, send(t, e, http.MethodPost, "/api/tasks", map[string]any{
		"equipment_id": eqID, "name": "Hull inspection", "months_interval": 12,
	}), http.StatusCreated, "create")

	if task["kind"] != "interval" {
		t.Errorf("kind = %v, want interval", task["kind"])
	}
}

func TestExpiryTask_RejectedTaskInputs(t *testing.T) {
	cases := []struct {
		name string
		body map[string]any
	}{
		{"an expiry task with a months interval", map[string]any{"kind": "expiry", "months_interval": 12}},
		{"an expiry task with an hours interval", map[string]any{"kind": "expiry", "hours_interval": 100}},
		{"an interval task with a current expiry date", map[string]any{"kind": "interval", "months_interval": 12, "current_expiry_date": day(30)}},
		{"an unknown kind", map[string]any{"kind": "part"}},
		{"a malformed current expiry date", map[string]any{"kind": "expiry", "current_expiry_date": "next year"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e, h, _ := newTestServer(t)
			body := map[string]any{"equipment_id": seedEquipment(t, h), "name": "Task"}
			for k, v := range tc.body {
				body[k] = v
			}
			expectJSON(t, send(t, e, http.MethodPost, "/api/tasks", body), http.StatusBadRequest, "create")
		})
	}
}

func TestTask_KindCannotChangeOnUpdate(t *testing.T) {
	e, h, _ := newTestServer(t)
	eqID := seedEquipment(t, h)
	expiry := expectJSON(t, send(t, e, http.MethodPost, "/api/tasks", map[string]any{
		"equipment_id": eqID, "name": "Replace CO2 cartridge", "kind": "expiry",
	}), http.StatusCreated, "create expiry task")
	interval := expectJSON(t, send(t, e, http.MethodPost, "/api/tasks", map[string]any{
		"equipment_id": eqID, "name": "Hull inspection", "months_interval": 12,
	}), http.StatusCreated, "create interval task")

	expectJSON(t, send(t, e, http.MethodPut, taskPath(expiry["id"]), map[string]any{
		"equipment_id": eqID, "name": "Replace CO2 cartridge", "kind": "interval", "months_interval": 12,
	}), http.StatusBadRequest, "expiry to interval")
	expectJSON(t, send(t, e, http.MethodPut, taskPath(interval["id"]), map[string]any{
		"equipment_id": eqID, "name": "Hull inspection", "kind": "expiry",
	}), http.StatusBadRequest, "interval to expiry")

	// No kind sent: the task keeps its own.
	updated := expectJSON(t, send(t, e, http.MethodPut, taskPath(expiry["id"]), map[string]any{
		"equipment_id": eqID, "name": "Replace CO2 cartridges", "current_expiry_date": day(40),
	}), http.StatusOK, "update without kind")
	if updated["kind"] != "expiry" || updated["name"] != "Replace CO2 cartridges" || updated["next_due_date"] != day(40) {
		t.Errorf("updated kind = %v, name = %v, next_due_date = %v", updated["kind"], updated["name"], updated["next_due_date"])
	}
	// Its own kind sent: accepted.
	expectJSON(t, send(t, e, http.MethodPut, taskPath(interval["id"]), map[string]any{
		"equipment_id": eqID, "name": "Hull inspection", "kind": "interval", "months_interval": 6,
	}), http.StatusOK, "update with its own kind")
}

func TestExpiryTask_InterventionRequiresAnExpiryDate(t *testing.T) {
	e, h, _ := newTestServer(t)
	eqID := seedEquipment(t, h)
	task := expectJSON(t, send(t, e, http.MethodPost, "/api/tasks", map[string]any{
		"equipment_id": eqID, "name": "Replace CO2 cartridge", "kind": "expiry", "current_expiry_date": day(5),
	}), http.StatusCreated, "create")
	taskID := task["id"]

	expectJSON(t, send(t, e, http.MethodPost, "/api/interventions", map[string]any{
		"task_id": taskID, "date": time.Now().Add(-time.Hour),
	}), http.StatusBadRequest, "without an expiry date")
	expectJSON(t, send(t, e, http.MethodPost, "/api/interventions", map[string]any{
		"task_id": taskID, "date": time.Now().Add(-time.Hour), "expiry_date": "soon",
	}), http.StatusBadRequest, "with a malformed expiry date")

	// An expired part is accepted: it sometimes has to be fitted.
	inv := expectJSON(t, send(t, e, http.MethodPost, "/api/interventions", map[string]any{
		"task_id": taskID, "date": time.Now().Add(-time.Hour), "expiry_date": day(-3),
	}), http.StatusCreated, "with an expiry date already past")
	if inv["expiry_date"] != day(-3) {
		t.Errorf("expiry_date = %v, want %v", inv["expiry_date"], day(-3))
	}

	got := expectJSON(t, send(t, e, http.MethodGet, taskPath(taskID), nil), http.StatusOK, "get task")
	if got["next_due_date"] != day(-3) || got["due_status"] != "overdue" || got["due_in_days"] != -3.0 {
		t.Errorf("next_due_date = %v, due_status = %v, due_in_days = %v, want %v, overdue, -3", got["next_due_date"], got["due_status"], got["due_in_days"], day(-3))
	}
	// Fitted already expired: at the top of the overdue tasks.
	if u, ok := got["urgency"].(float64); !ok || u < 1e300 {
		t.Errorf("urgency = %v, want the largest double", got["urgency"])
	}
}

func TestExpiryTask_EditingOrDeletingTheLatestInterventionUpdatesTheDate(t *testing.T) {
	e, h, _ := newTestServer(t)
	eqID := seedEquipment(t, h)
	task := expectJSON(t, send(t, e, http.MethodPost, "/api/tasks", map[string]any{
		"equipment_id": eqID, "name": "Replace CO2 cartridge", "kind": "expiry", "current_expiry_date": day(5),
	}), http.StatusCreated, "create")
	taskID := task["id"]
	date := time.Now().Add(-time.Hour)

	inv := expectJSON(t, send(t, e, http.MethodPost, "/api/interventions", map[string]any{
		"task_id": taskID, "date": date, "expiry_date": day(400),
	}), http.StatusCreated, "log")
	invPath := "/api/interventions/" + itoa(int(inv["id"].(float64)))

	expectJSON(t, send(t, e, http.MethodPut, invPath, map[string]any{
		"task_id": taskID, "date": date,
	}), http.StatusBadRequest, "edit without an expiry date")
	expectJSON(t, send(t, e, http.MethodPut, invPath, map[string]any{
		"task_id": taskID, "date": date, "expiry_date": day(200),
	}), http.StatusOK, "edit")
	if got := expectJSON(t, send(t, e, http.MethodGet, taskPath(taskID), nil), http.StatusOK, "get"); got["next_due_date"] != day(200) {
		t.Errorf("after edit next_due_date = %v, want %v", got["next_due_date"], day(200))
	}

	// The current expiry date belonged to the part since replaced: it does not come back.
	expectJSON(t, send(t, e, http.MethodDelete, invPath, nil), http.StatusNoContent, "delete")
	expectNoExpiryDate(t, expectJSON(t, send(t, e, http.MethodGet, taskPath(taskID), nil), http.StatusOK, "get after delete"))
}

func TestExpiryTask_MovingAnInterventionOntoItClearsTheCurrentExpiryDate(t *testing.T) {
	e, h, _ := newTestServer(t)
	eqID := seedEquipment(t, h)
	task := expectJSON(t, send(t, e, http.MethodPost, "/api/tasks", map[string]any{
		"equipment_id": eqID, "name": "Replace CO2 cartridge", "kind": "expiry", "current_expiry_date": day(5),
	}), http.StatusCreated, "create")
	taskID := task["id"]
	date := time.Now().Add(-time.Hour)

	inv := expectJSON(t, send(t, e, http.MethodPost, "/api/interventions", map[string]any{
		"equipment_id": eqID, "exceptional_label": "Replaced cartridge", "date": date,
	}), http.StatusCreated, "log exceptional")
	invPath := "/api/interventions/" + itoa(int(inv["id"].(float64)))
	expectJSON(t, send(t, e, http.MethodPut, invPath, map[string]any{
		"task_id": taskID, "date": date, "expiry_date": day(300),
	}), http.StatusOK, "move onto the expiry task")

	expectJSON(t, send(t, e, http.MethodDelete, invPath, nil), http.StatusNoContent, "delete")
	expectNoExpiryDate(t, expectJSON(t, send(t, e, http.MethodGet, taskPath(taskID), nil), http.StatusOK, "get after delete"))
}

// expectNoExpiryDate asserts an expiry task is overdue with no date at all.
func expectNoExpiryDate(t *testing.T, task map[string]any) {
	t.Helper()
	if task["due_status"] != "overdue" || task["due_trigger"] != "expiry" {
		t.Errorf("due_status = %v, due_trigger = %v, want overdue, expiry", task["due_status"], task["due_trigger"])
	}
	for _, k := range []string{"current_expiry_date", "next_due_date", "due_in_days", "urgency"} {
		if _, ok := task[k]; ok {
			t.Errorf("%s = %v, want absent", k, task[k])
		}
	}
}

func TestExpiryDate_RejectedOutsideExpiryTasks(t *testing.T) {
	e, h, _ := newTestServer(t)
	eqID := seedEquipment(t, h)
	interval := expectJSON(t, send(t, e, http.MethodPost, "/api/tasks", map[string]any{
		"equipment_id": eqID, "name": "Hull inspection", "months_interval": 12,
	}), http.StatusCreated, "create")

	expectJSON(t, send(t, e, http.MethodPost, "/api/interventions", map[string]any{
		"task_id": interval["id"], "date": time.Now().Add(-time.Hour), "expiry_date": day(30),
	}), http.StatusBadRequest, "on an interval task")
	expectJSON(t, send(t, e, http.MethodPost, "/api/interventions", map[string]any{
		"equipment_id": eqID, "exceptional_label": "Replaced flare", "date": time.Now().Add(-time.Hour), "expiry_date": day(30),
	}), http.StatusBadRequest, "on an exceptional intervention")
}

func TestIntervention_MovingBetweenTaskKindsChecksTheExpiryDate(t *testing.T) {
	e, h, _ := newTestServer(t)
	eqID := seedEquipment(t, h)
	expiry := expectJSON(t, send(t, e, http.MethodPost, "/api/tasks", map[string]any{
		"equipment_id": eqID, "name": "Replace CO2 cartridge", "kind": "expiry", "current_expiry_date": day(5),
	}), http.StatusCreated, "create expiry task")
	interval := expectJSON(t, send(t, e, http.MethodPost, "/api/tasks", map[string]any{
		"equipment_id": eqID, "name": "Hull inspection", "months_interval": 12,
	}), http.StatusCreated, "create interval task")
	date := time.Now().Add(-time.Hour)

	onInterval := expectJSON(t, send(t, e, http.MethodPost, "/api/interventions", map[string]any{
		"task_id": interval["id"], "date": date,
	}), http.StatusCreated, "log on the interval task")
	expectJSON(t, send(t, e, http.MethodPut, "/api/interventions/"+itoa(int(onInterval["id"].(float64))), map[string]any{
		"task_id": expiry["id"], "date": date,
	}), http.StatusBadRequest, "interval-task intervention onto the expiry task without an expiry date")

	onExpiry := expectJSON(t, send(t, e, http.MethodPost, "/api/interventions", map[string]any{
		"task_id": expiry["id"], "date": date, "expiry_date": day(300),
	}), http.StatusCreated, "log on the expiry task")
	expectJSON(t, send(t, e, http.MethodPut, "/api/interventions/"+itoa(int(onExpiry["id"].(float64))), map[string]any{
		"task_id": interval["id"], "date": date, "expiry_date": day(300),
	}), http.StatusBadRequest, "expiry-task intervention onto the interval task still sending an expiry date")
}

// UpdateTask now reads the stored task first to keep its kind: a task that
// does not exist must still be a 404, not a 400 or 500.
func TestTask_UpdateMissingTaskIsNotFound(t *testing.T) {
	e, h, _ := newTestServer(t)
	eqID := seedEquipment(t, h)

	expectJSON(t, send(t, e, http.MethodPut, "/api/tasks/9999", map[string]any{
		"equipment_id": eqID, "name": "Hull inspection", "months_interval": 12,
	}), http.StatusNotFound, "update a missing task")
}
