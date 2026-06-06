package tests

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/generated"
	"github.com/vtellier/OpenMaintenance/internal/handlers"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

// newTestServer spins up an Echo server backed by a fresh DB in a temp dir,
// with the files/ tree rooted alongside it.
func newTestServer(t *testing.T) (*echo.Echo, *handlers.Handler, string) {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "maintenance.db")

	database, err := db.InitDB(dbPath, "test", db.BackupConfig{Enabled: false})
	if err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	h := &handlers.Handler{DB: database, Version: "test", BaseDir: dir}
	e := echo.New()
	generated.RegisterHandlersWithBaseURL(e, h, "/api")
	return e, h, dir
}

func seedEquipment(t *testing.T, h *handlers.Handler) int {
	t.Helper()
	eq := &models.Equipment{Name: "Engine"}
	if err := db.CreateEquipment(h.DB, eq); err != nil {
		t.Fatalf("CreateEquipment: %v", err)
	}
	return eq.ID
}

func uploadDoc(t *testing.T, e *echo.Echo, equipmentID int, filename string, content []byte) *httptest.ResponseRecorder {
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
		"/api/equipments/"+itoa(equipmentID)+"/files", &body)
	req.Header.Set(echo.HeaderContentType, w.FormDataContentType())
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func itoa(i int) string { return strconv.Itoa(i) }

func TestEquipmentFile_UploadListDownloadDelete(t *testing.T) {
	e, h, baseDir := newTestServer(t)
	id := seedEquipment(t, h)

	content := []byte("%PDF-1.4 fake manual contents")

	// Upload.
	rec := uploadDoc(t, e, id, "manual.pdf", content)
	if rec.Code != http.StatusCreated {
		t.Fatalf("upload: expected 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	var created generated.FileInfo
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}
	if created.OriginalName != "manual.pdf" {
		t.Errorf("original_name = %q, want manual.pdf", created.OriginalName)
	}
	if created.Size != int64(len(content)) {
		t.Errorf("size = %d, want %d", created.Size, len(content))
	}
	if filepath.Ext(created.Name) != ".pdf" {
		t.Errorf("stored name %q should keep .pdf extension", created.Name)
	}

	// File is on disk.
	absDir := filepath.Join(baseDir, "files", "equipments", itoa(id), "files")
	entries, _ := os.ReadDir(absDir)
	if len(entries) != 1 {
		t.Fatalf("expected 1 file on disk, got %d", len(entries))
	}

	// List.
	listReq := httptest.NewRequest(http.MethodGet, "/api/equipments/"+itoa(id)+"/files", nil)
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

	// Download.
	getReq := httptest.NewRequest(http.MethodGet,
		"/api/equipments/"+itoa(id)+"/files/"+created.Name, nil)
	getRec := httptest.NewRecorder()
	e.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("download: expected 200, got %d", getRec.Code)
	}
	if !bytes.Equal(getRec.Body.Bytes(), content) {
		t.Errorf("downloaded bytes differ from uploaded")
	}
	if cd := getRec.Header().Get("Content-Disposition"); cd != `attachment; filename="manual.pdf"` {
		t.Errorf("Content-Disposition = %q", cd)
	}

	// Delete.
	delReq := httptest.NewRequest(http.MethodDelete,
		"/api/equipments/"+itoa(id)+"/files/"+created.Name, nil)
	delRec := httptest.NewRecorder()
	e.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("delete: expected 204, got %d", delRec.Code)
	}

	// Gone from disk and DB.
	entries, _ = os.ReadDir(absDir)
	if len(entries) != 0 {
		t.Errorf("file still on disk after delete")
	}
	rows, _ := db.ListEquipmentFiles(h.DB, id)
	if len(rows) != 0 {
		t.Errorf("row still in DB after delete")
	}
}

func TestEquipmentFile_UploadToMissingEquipment(t *testing.T) {
	e, _, _ := newTestServer(t)
	rec := uploadDoc(t, e, 999, "x.txt", []byte("hi"))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for missing equipment, got %d", rec.Code)
	}
}

func TestEquipmentFile_DeleteEquipmentCascadesFiles(t *testing.T) {
	e, h, baseDir := newTestServer(t)
	id := seedEquipment(t, h)

	uploadDoc(t, e, id, "a.txt", []byte("aaa"))
	uploadDoc(t, e, id, "b.txt", []byte("bbb"))

	delReq := httptest.NewRequest(http.MethodDelete, "/api/equipments/"+itoa(id), nil)
	delRec := httptest.NewRecorder()
	e.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("delete equipment: expected 204, got %d", delRec.Code)
	}

	dir := filepath.Join(baseDir, "files", "equipments", itoa(id))
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Errorf("equipment files dir should be removed after equipment delete")
	}
	rows, _ := db.ListEquipmentFiles(h.DB, id)
	if len(rows) != 0 {
		t.Errorf("equipment_files rows should be gone after cascade")
	}
}
