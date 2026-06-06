package tests

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/generated"
	"github.com/vtellier/OpenMaintenance/internal/handlers"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

// pngBytes is a minimal blob whose leading bytes sniff as image/png.
var pngBytes = append([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}, []byte("fake png body")...)

func seedTask(t *testing.T, h *handlers.Handler, equipmentID int) int {
	t.Helper()
	hours := 100
	task := &models.Task{EquipmentID: equipmentID, Name: "Oil change", HoursInterval: &hours}
	if err := db.CreateTask(h.DB, task); err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	return task.ID
}

func seedIntervention(t *testing.T, h *handlers.Handler, equipmentID, taskID int) int {
	t.Helper()
	inv := &models.Intervention{TaskID: &taskID, EquipmentID: &equipmentID, Date: time.Now()}
	if err := db.CreateIntervention(h.DB, inv); err != nil {
		t.Fatalf("CreateIntervention: %v", err)
	}
	return inv.ID
}

func uploadPhoto(t *testing.T, e *echo.Echo, interventionID int, filename string, content []byte) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	part, err := w.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}
	part.Write(content)
	w.Close()

	req := httptest.NewRequest(http.MethodPost,
		"/api/interventions/"+itoa(interventionID)+"/files", &body)
	req.Header.Set(echo.HeaderContentType, w.FormDataContentType())
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func interventionPhotoDir(baseDir string, equipmentID, interventionID int) string {
	return filepath.Join(baseDir, "files", "equipments", itoa(equipmentID), "interventions", itoa(interventionID))
}

func TestInterventionFile_UploadListServeDelete(t *testing.T) {
	e, h, baseDir := newTestServer(t)
	eqID := seedEquipment(t, h)
	taskID := seedTask(t, h, eqID)
	invID := seedIntervention(t, h, eqID, taskID)

	// Upload.
	rec := uploadPhoto(t, e, invID, "before.png", pngBytes)
	if rec.Code != http.StatusCreated {
		t.Fatalf("upload: expected 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	var created generated.FileInfo
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}
	if created.OriginalName != "before.png" {
		t.Errorf("original_name = %q, want before.png", created.OriginalName)
	}
	if created.MimeType != "image/png" {
		t.Errorf("mime_type = %q, want image/png", created.MimeType)
	}
	if filepath.Ext(created.Name) != ".png" {
		t.Errorf("stored name %q should derive a .png extension", created.Name)
	}

	// File on disk.
	entries, _ := os.ReadDir(interventionPhotoDir(baseDir, eqID, invID))
	if len(entries) != 1 {
		t.Fatalf("expected 1 file on disk, got %d", len(entries))
	}

	// List.
	listReq := httptest.NewRequest(http.MethodGet,
		"/api/interventions/"+itoa(invID)+"/files", nil)
	listRec := httptest.NewRecorder()
	e.ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d", listRec.Code)
	}
	var listed []generated.FileInfo
	json.Unmarshal(listRec.Body.Bytes(), &listed)
	if len(listed) != 1 {
		t.Fatalf("list: expected 1 file, got %d", len(listed))
	}

	// Serve (inline).
	getReq := httptest.NewRequest(http.MethodGet,
		"/api/interventions/"+itoa(invID)+"/files/"+created.Name, nil)
	getRec := httptest.NewRecorder()
	e.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("serve: expected 200, got %d", getRec.Code)
	}
	if !bytes.Equal(getRec.Body.Bytes(), pngBytes) {
		t.Errorf("served bytes differ from uploaded")
	}
	if cd := getRec.Header().Get("Content-Disposition"); cd != "inline" {
		t.Errorf("Content-Disposition = %q, want inline", cd)
	}

	// Delete.
	delReq := httptest.NewRequest(http.MethodDelete,
		"/api/interventions/"+itoa(invID)+"/files/"+created.Name, nil)
	delRec := httptest.NewRecorder()
	e.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("delete: expected 204, got %d", delRec.Code)
	}

	entries, _ = os.ReadDir(interventionPhotoDir(baseDir, eqID, invID))
	if len(entries) != 0 {
		t.Errorf("file still on disk after delete")
	}
	rows, _ := db.ListInterventionFiles(h.DB, invID)
	if len(rows) != 0 {
		t.Errorf("row still in DB after delete")
	}
}

func TestInterventionFile_RejectsNonImage(t *testing.T) {
	e, h, _ := newTestServer(t)
	eqID := seedEquipment(t, h)
	taskID := seedTask(t, h, eqID)
	invID := seedIntervention(t, h, eqID, taskID)

	rec := uploadPhoto(t, e, invID, "manual.pdf", []byte("%PDF-1.4 not an image"))
	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415 for non-image, got %d (%s)", rec.Code, rec.Body.String())
	}
}

func TestInterventionFile_MissingIntervention(t *testing.T) {
	e, _, _ := newTestServer(t)

	rec := uploadPhoto(t, e, 999, "before.png", pngBytes)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for missing intervention, got %d", rec.Code)
	}
}

func TestInterventionFile_DeleteInterventionCascadesFiles(t *testing.T) {
	e, h, baseDir := newTestServer(t)
	eqID := seedEquipment(t, h)
	taskID := seedTask(t, h, eqID)
	invID := seedIntervention(t, h, eqID, taskID)

	uploadPhoto(t, e, invID, "a.png", pngBytes)
	uploadPhoto(t, e, invID, "b.png", pngBytes)

	delReq := httptest.NewRequest(http.MethodDelete, "/api/interventions/"+itoa(invID), nil)
	delRec := httptest.NewRecorder()
	e.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("delete intervention: expected 204, got %d", delRec.Code)
	}

	if _, err := os.Stat(interventionPhotoDir(baseDir, eqID, invID)); !os.IsNotExist(err) {
		t.Errorf("intervention photo dir should be removed after intervention delete")
	}
	rows, _ := db.ListInterventionFiles(h.DB, invID)
	if len(rows) != 0 {
		t.Errorf("intervention_files rows should be gone after cascade")
	}
}

func TestInterventionFile_DeleteEquipmentCascadesFiles(t *testing.T) {
	e, h, baseDir := newTestServer(t)
	eqID := seedEquipment(t, h)
	taskID := seedTask(t, h, eqID)
	invID := seedIntervention(t, h, eqID, taskID)

	uploadPhoto(t, e, invID, "a.png", pngBytes)

	delReq := httptest.NewRequest(http.MethodDelete, "/api/equipments/"+itoa(eqID), nil)
	delRec := httptest.NewRecorder()
	e.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("delete equipment: expected 204, got %d", delRec.Code)
	}

	if _, err := os.Stat(filepath.Join(baseDir, "files", "equipments", itoa(eqID))); !os.IsNotExist(err) {
		t.Errorf("equipment files dir should be removed after equipment delete")
	}
	rows, _ := db.ListInterventionFiles(h.DB, invID)
	if len(rows) != 0 {
		t.Errorf("intervention_files rows should be gone after equipment cascade")
	}
}
