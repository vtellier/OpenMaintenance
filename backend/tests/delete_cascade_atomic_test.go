package tests

import (
	"net/http"
	"path/filepath"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/handlers"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

// Issue #128: deleting an equipment, a task or an intervention ran its cascade
// statement by statement, outside any transaction, and ignored the errors of
// most of them. A failure left the owner half deleted, or answered 204 with
// rows still pointing at it. Each delete is now one transaction: on failure
// the API answers 500 and nothing is deleted.

// ownedFixture is an equipment with one document, one task with one
// intervention, and one exceptional intervention; each intervention has one
// photo.
type ownedFixture struct {
	e                *echo.Echo
	h                *handlers.Handler
	baseDir          string
	eq, task         int
	inv, exceptional int
}

func setupOwnedFixture(t *testing.T) ownedFixture {
	t.Helper()
	e, h, baseDir := newTestServer(t)
	eq := seedEquipment(t, h)
	task := seedTask(t, h, eq)
	inv := seedIntervention(t, h, eq, task)
	label := "Replaced broken part"
	exc := &models.Intervention{EquipmentID: &eq, ExceptionalLabel: &label, Date: time.Now()}
	if err := db.CreateIntervention(h.DB, exc); err != nil {
		t.Fatalf("CreateIntervention: %v", err)
	}

	if rec := uploadDoc(t, e, eq, "manual.pdf", []byte("manual")); rec.Code != http.StatusCreated {
		t.Fatalf("upload document: expected 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	for _, id := range []int{inv, exc.ID} {
		if rec := uploadPhoto(t, e, id, "photo.png", pngBytes); rec.Code != http.StatusCreated {
			t.Fatalf("upload photo: expected 201, got %d (%s)", rec.Code, rec.Body.String())
		}
	}
	return ownedFixture{e: e, h: h, baseDir: baseDir, eq: eq, task: task, inv: inv, exceptional: exc.ID}
}

// assertNothingDeleted checks that the equipment, its task, its interventions,
// its document and both photos are all still there, listed through the API and
// on disk.
func assertNothingDeleted(t *testing.T, f ownedFixture) {
	t.Helper()
	for _, path := range []string{
		"/api/equipments/" + itoa(f.eq),
		"/api/tasks/" + itoa(f.task),
		"/api/interventions/" + itoa(f.inv),
		"/api/interventions/" + itoa(f.exceptional),
	} {
		if rec := request(f.e, http.MethodGet, path); rec.Code != http.StatusOK {
			t.Errorf("GET %s: expected 200, got %d (%s)", path, rec.Code, rec.Body.String())
		}
	}

	if docs := listDocs(t, f.e, f.eq); len(docs) != 1 || docs[0].Missing {
		t.Errorf("documents = %+v, want the one document, on disk", docs)
	}
	for _, id := range []int{f.inv, f.exceptional} {
		if photos := listPhotoFiles(t, f.e, id); len(photos) != 1 || photos[0].Missing {
			t.Errorf("photos of intervention %d = %+v, want the one photo, on disk", id, photos)
		}
	}

	if n := countFiles(t, filepath.Join(f.baseDir, "files", "equipments", itoa(f.eq))); n != 3 {
		t.Errorf("files on disk under the equipment = %d, want 3", n)
	}
}

func TestDelete_FailureInTheCascadeDeletesNothing(t *testing.T) {
	cases := []struct {
		name    string
		failing string // the table whose DELETE is made to fail
		path    func(f ownedFixture) string
	}{
		{"equipment, failing on equipments", "equipments", equipmentPath},
		{"equipment, failing on tasks", "tasks", equipmentPath},
		{"equipment, failing on interventions", "interventions", equipmentPath},
		{"equipment, failing on equipment_files", "equipment_files", equipmentPath},
		{"equipment, failing on intervention_files", "intervention_files", equipmentPath},
		{"task, failing on tasks", "tasks", taskDeletePath},
		{"task, failing on interventions", "interventions", taskDeletePath},
		{"task, failing on intervention_files", "intervention_files", taskDeletePath},
		{"intervention, failing on interventions", "interventions", interventionPath},
		{"intervention, failing on intervention_files", "intervention_files", interventionPath},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := setupOwnedFixture(t)
			if _, err := f.h.DB.Exec(`CREATE TRIGGER fail_delete BEFORE DELETE ON ` + tc.failing +
				` BEGIN SELECT RAISE(ABORT, 'injected failure'); END`); err != nil {
				t.Fatalf("create trigger: %v", err)
			}

			rec := request(f.e, http.MethodDelete, tc.path(f))
			if rec.Code != http.StatusInternalServerError {
				t.Errorf("delete: expected 500, got %d (%s)", rec.Code, rec.Body.String())
			}

			if _, err := f.h.DB.Exec(`DROP TRIGGER fail_delete`); err != nil {
				t.Fatalf("drop trigger: %v", err)
			}
			assertNothingDeleted(t, f)
		})
	}
}

func equipmentPath(f ownedFixture) string    { return "/api/equipments/" + itoa(f.eq) }
func taskDeletePath(f ownedFixture) string   { return "/api/tasks/" + itoa(f.task) }
func interventionPath(f ownedFixture) string { return "/api/interventions/" + itoa(f.inv) }
