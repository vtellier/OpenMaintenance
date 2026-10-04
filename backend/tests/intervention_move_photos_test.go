package tests

import (
	"bytes"
	"encoding/json"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/generated"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

// Issue #75: editing an intervention so that it belongs to another equipment
// left its photos under the old equipment's directory. The photo then returned
// 404, the file lingered on disk under the old equipment, and deleting the
// intervention afterwards did not remove it.

// putIntervention sends PUT /api/interventions/{id} with the given JSON body.
func putIntervention(t *testing.T, e *echo.Echo, id int, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPut, "/api/interventions/"+itoa(id), bytes.NewReader(raw))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

// countFiles returns the number of regular files under root, or 0 when root
// does not exist.
func countFiles(t *testing.T, root string) int {
	t.Helper()
	n := 0
	err := filepath.WalkDir(root, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.Type().IsRegular() {
			n++
		}
		return nil
	})
	if err != nil && !os.IsNotExist(err) {
		t.Fatalf("walk %s: %v", root, err)
	}
	return n
}

// moveScenario is one way of editing an intervention so that it ends up on
// another equipment.
type moveScenario struct {
	name string
	// body builds the PUT body that moves the intervention to equipment eq2,
	// whose task is task2.
	body func(eq2, task2 int) map[string]any
}

var moveScenarios = []moveScenario{
	{
		name: "to a task on another equipment",
		body: func(_, task2 int) map[string]any {
			return map[string]any{
				"task_id": task2,
				"date":    time.Now().Add(-time.Hour).Format(time.RFC3339),
			}
		},
	},
	{
		name: "exceptional, to another equipment",
		body: func(eq2, _ int) map[string]any {
			return map[string]any{
				"equipment_id":      eq2,
				"exceptional_label": "Replaced broken part",
				"date":              time.Now().Add(-time.Hour).Format(time.RFC3339),
			}
		},
	},
}

// movedIntervention is an intervention logged with one photo on equipment eq1,
// then edited onto equipment eq2 through the API.
type movedIntervention struct {
	e        *echo.Echo
	baseDir  string
	eq1, eq2 int
	invID    int
	photo    generated.FileInfo
}

func setupMovedIntervention(t *testing.T, sc moveScenario) movedIntervention {
	t.Helper()
	e, h, baseDir := newTestServer(t)
	eq1 := seedEquipment(t, h)
	eq2 := seedEquipment(t, h)
	task1 := seedTask(t, h, eq1)
	task2 := seedTask(t, h, eq2)
	invID := seedIntervention(t, h, eq1, task1)

	rec := uploadPhoto(t, e, invID, "before.png", pngBytes)
	if rec.Code != http.StatusCreated {
		t.Fatalf("upload: expected 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	var photo generated.FileInfo
	if err := json.Unmarshal(rec.Body.Bytes(), &photo); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}

	rec = putIntervention(t, e, invID, sc.body(eq2, task2))
	if rec.Code != http.StatusOK {
		t.Fatalf("move: expected 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	var moved models.Intervention
	if err := json.Unmarshal(rec.Body.Bytes(), &moved); err != nil {
		t.Fatalf("decode move response: %v", err)
	}
	if moved.EquipmentID == nil || *moved.EquipmentID != eq2 {
		t.Fatalf("move: equipment_id = %v, want %d", moved.EquipmentID, eq2)
	}

	return movedIntervention{e: e, baseDir: baseDir, eq1: eq1, eq2: eq2, invID: invID, photo: photo}
}

func TestInterventionFile_MoveToOtherEquipmentKeepsPhotos(t *testing.T) {
	for _, sc := range moveScenarios {
		t.Run(sc.name, func(t *testing.T) {
			m := setupMovedIntervention(t, sc)
			e, invID := m.e, m.invID

			// (a) The photo is still downloadable at its URL.
			getRec := httptest.NewRecorder()
			e.ServeHTTP(getRec, httptest.NewRequest(http.MethodGet, m.photo.Url, nil))
			if getRec.Code != http.StatusOK {
				t.Errorf("serve after move: expected 200, got %d (%s)", getRec.Code, getRec.Body.String())
			} else if !bytes.Equal(getRec.Body.Bytes(), pngBytes) {
				t.Errorf("serve after move: bytes differ from the uploaded photo")
			}

			// (b) The photo count and the photo list are right.
			invRec := httptest.NewRecorder()
			e.ServeHTTP(invRec, httptest.NewRequest(http.MethodGet, "/api/interventions/"+itoa(invID), nil))
			var got models.Intervention
			json.Unmarshal(invRec.Body.Bytes(), &got)
			if got.PhotoCount != 1 {
				t.Errorf("photo_count after move = %d, want 1", got.PhotoCount)
			}
			listRec := httptest.NewRecorder()
			e.ServeHTTP(listRec, httptest.NewRequest(http.MethodGet, "/api/interventions/"+itoa(invID)+"/files", nil))
			var listed []generated.FileInfo
			json.Unmarshal(listRec.Body.Bytes(), &listed)
			if len(listed) != 1 {
				t.Fatalf("list after move: expected 1 photo, got %d (%s)", len(listed), listRec.Body.String())
			}
			if listed[0].Size != int64(len(pngBytes)) {
				t.Errorf("list after move: size = %d, want %d", listed[0].Size, len(pngBytes))
			}

			// (c) The photo now lives under the new equipment, and nothing is
			// left under the old one.
			if n := countFiles(t, interventionPhotoDir(m.baseDir, m.eq2, invID)); n != 1 {
				t.Errorf("files under the new equipment = %d, want 1", n)
			}
			oldEquipmentDir := filepath.Join(m.baseDir, "files", "equipments", itoa(m.eq1))
			if n := countFiles(t, oldEquipmentDir); n != 0 {
				t.Errorf("files left under the old equipment = %d, want 0", n)
			}
		})
	}
}

func TestInterventionFile_DeleteMovedInterventionRemovesPhotos(t *testing.T) {
	for _, sc := range moveScenarios {
		t.Run(sc.name, func(t *testing.T) {
			m := setupMovedIntervention(t, sc)

			delRec := httptest.NewRecorder()
			m.e.ServeHTTP(delRec, httptest.NewRequest(http.MethodDelete, "/api/interventions/"+itoa(m.invID), nil))
			if delRec.Code != http.StatusNoContent {
				t.Fatalf("delete: expected 204, got %d (%s)", delRec.Code, delRec.Body.String())
			}

			// (d) No photo of the deleted intervention is left on disk, under
			// either equipment.
			if n := countFiles(t, filepath.Join(m.baseDir, "files")); n != 0 {
				t.Errorf("files left on disk after deleting the moved intervention = %d, want 0", n)
			}
		})
	}
}
