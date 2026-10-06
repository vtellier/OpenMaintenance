package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/handlers"
)

func TestGetBackupStatus_Disabled(t *testing.T) {
	e := echo.New()
	h := &handlers.Handler{BackupEnabled: false}
	req := httptest.NewRequest(http.MethodGet, "/api/backups", nil)
	rec := httptest.NewRecorder()
	if err := h.GetBackupStatus(e.NewContext(req, rec)); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp["enabled"] != false {
		t.Errorf("expected enabled=false, got %v", resp["enabled"])
	}
	if files, ok := resp["files"].([]interface{}); !ok || len(files) != 0 {
		t.Errorf("expected empty files list when disabled, got %v", resp["files"])
	}
}

func TestGetBackupStatus_EmptyDir(t *testing.T) {
	dir := t.TempDir()
	e := echo.New()
	h := &handlers.Handler{BackupEnabled: true, BackupPath: dir, BackupKeep: 7}
	req := httptest.NewRequest(http.MethodGet, "/api/backups", nil)
	rec := httptest.NewRecorder()
	if err := h.GetBackupStatus(e.NewContext(req, rec)); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if files, ok := resp["files"].([]interface{}); !ok || len(files) != 0 {
		t.Errorf("expected empty files list, got %v", resp["files"])
	}
}

func TestGetBackupStatus_WithFiles(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "maintenance.20260601-120000.bak"), []byte("old"))
	writeFile(t, filepath.Join(dir, "maintenance.20260622-120000.bak"), []byte("new content"))
	writeFile(t, filepath.Join(dir, "maintenance.20260701-090000.tar.gz"), []byte("archive"))
	// Not backups: ignored.
	writeFile(t, filepath.Join(dir, "notes.txt"), []byte("x"))
	writeFile(t, filepath.Join(dir, ".tmp-backup-123", "backup.tar.gz"), []byte("partial"))

	e := echo.New()
	h := &handlers.Handler{BackupEnabled: true, BackupPath: dir, BackupKeep: 7}
	req := httptest.NewRequest(http.MethodGet, "/api/backups", nil)
	rec := httptest.NewRecorder()
	if err := h.GetBackupStatus(e.NewContext(req, rec)); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	files, ok := resp["files"].([]interface{})
	if !ok || len(files) != 3 {
		t.Fatalf("expected 3 files, got %v", resp["files"])
	}

	// Newest first, whatever the format; created_at is parsed from the
	// filename timestamp (server local time, as written), not mtime.
	local := func(y int, m time.Month, d, h int) string {
		return time.Date(y, m, d, h, 0, 0, 0, time.Local).UTC().Format(time.RFC3339)
	}
	want := []struct{ name, createdAt string }{
		{"maintenance.20260701-090000.tar.gz", local(2026, 7, 1, 9)},
		{"maintenance.20260622-120000.bak", local(2026, 6, 22, 12)},
		{"maintenance.20260601-120000.bak", local(2026, 6, 1, 12)},
	}
	for i, w := range want {
		f := files[i].(map[string]interface{})
		if f["name"] != w.name || f["created_at"] != w.createdAt {
			t.Errorf("files[%d] = %v %v, want %s %s", i, f["name"], f["created_at"], w.name, w.createdAt)
		}
	}
	if size := files[0].(map[string]interface{})["size"]; size != float64(len("archive")) {
		t.Errorf("archive size = %v, want %d", size, len("archive"))
	}
}
