package tests

import (
	"net/http"
	"testing"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/handlers"
)

// Issue #131: saving an intervention answered 201/200 when the hour-meter
// reading it raises could not be written. The intervention was stored, the
// reading was not, and only a log line told. Storing the intervention and
// raising the reading now happen together, or not at all
// (doc/data-model.md, Intervention side effects).

// failReadingWrites makes every write of an equipment's reading fail, as a
// database error would.
func failReadingWrites(t *testing.T, h *handlers.Handler) {
	t.Helper()
	if _, err := h.DB.Exec(`CREATE TRIGGER fail_reading_write
		BEFORE UPDATE OF hours ON equipments
		BEGIN SELECT RAISE(ABORT, 'injected failure'); END`); err != nil {
		t.Fatalf("create trigger: %v", err)
	}
}

func TestLogIntervention_ReadingWriteFails_NothingSaved(t *testing.T) {
	f, h := newMeterFixture(t)
	eq := seedHourEquipment(t, h, 100, 72*time.Hour)
	task := seedTask(t, h, eq)
	before := f.equipment(eq)
	failReadingWrites(t, h)

	rec := f.do(http.MethodPost, "/interventions", interventionBody(task, 150))
	f.expect(rec, http.StatusInternalServerError, "log intervention")

	if list := listInterventions(t, f); len(list) != 0 {
		t.Errorf("interventions after the failed log = %d, want 0", len(list))
	}
	after := f.equipment(eq)
	assertReading(t, after, 100)
	assertFreshnessUnchanged(t, before, after)
}

func TestEditIntervention_ReadingWriteFails_NothingSaved(t *testing.T) {
	f, h := newMeterFixture(t)
	eq := seedHourEquipment(t, h, 100, 72*time.Hour)
	task := seedTask(t, h, eq)
	inv := seedIntervention(t, h, eq, task)
	before := f.equipment(eq)
	failReadingWrites(t, h)

	body := interventionBody(task, 150)
	body["comments"] = "edited"
	rec := f.do(http.MethodPut, "/interventions/"+itoa(inv), body)
	f.expect(rec, http.StatusInternalServerError, "edit intervention")

	list := listInterventions(t, f)
	if len(list) != 1 {
		t.Fatalf("interventions after the failed edit = %d, want 1", len(list))
	}
	if got := list[0]; got.HoursAt != nil || got.Comments != nil {
		t.Errorf("intervention after the failed edit: hours_at = %v, comments = %v, want both unset as seeded",
			fmtHours(got.HoursAt), got.Comments)
	}
	after := f.equipment(eq)
	assertReading(t, after, 100)
	assertFreshnessUnchanged(t, before, after)
}

// An edit that moves the intervention to another equipment raises the new
// equipment's reading in the move's transaction: when that fails, the
// intervention and its photo stay on the original equipment.
func TestMoveIntervention_ReadingWriteFails_NothingSaved(t *testing.T) {
	e, h, baseDir := newTestServer(t)
	f := &meterFixture{t: t, e: e}
	eq1 := seedHourEquipment(t, h, 100, 72*time.Hour)
	eq2 := seedHourEquipment(t, h, 100, 72*time.Hour)
	task1 := seedTask(t, h, eq1)
	task2 := seedTask(t, h, eq2)
	inv := seedIntervention(t, h, eq1, task1)
	photo := decodeFile(t, uploadPhoto(t, e, inv, "before.png", pngBytes))
	before := f.equipment(eq2)
	failReadingWrites(t, h)

	rec := f.do(http.MethodPut, "/interventions/"+itoa(inv), interventionBody(task2, 150))
	f.expect(rec, http.StatusInternalServerError, "move intervention")

	assertPhotoStayed(t, photoFixture{e: e, h: h, baseDir: baseDir, eq1: eq1, eq2: eq2,
		task1: task1, task2: task2, invID: inv, photo: photo})
	if list := listInterventions(t, f); len(list) != 1 || list[0].HoursAt != nil {
		t.Errorf("interventions after the failed move = %d, want one, without a reading", len(list))
	}
	after := f.equipment(eq2)
	assertReading(t, after, 100)
	assertFreshnessUnchanged(t, before, after)
}
