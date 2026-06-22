package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

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
	if !ok || len(files) != 2 {
		t.Fatalf("expected 2 files, got %v", resp["files"])
	}

	// Newest file must come first (sorted descending by filename)
	first := files[0].(map[string]interface{})
	if first["name"] != "maintenance.20260622-120000.bak" {
		t.Errorf("expected newest file first, got %s", first["name"])
	}

	// created_at is parsed from the filename timestamp, not mtime
	if first["created_at"] != "2026-06-22T12:00:00Z" {
		t.Errorf("unexpected created_at: %s", first["created_at"])
	}
}
