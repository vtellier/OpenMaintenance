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

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/generated"
	"github.com/vtellier/OpenMaintenance/internal/handlers"
)

// jpegBytes is a minimal blob whose leading bytes sniff as image/jpeg.
// (pngBytes is shared from intervention_file_test.go.)
var jpegBytes = append([]byte{0xFF, 0xD8, 0xFF}, []byte("fake jpeg body")...)

func uploadPicture(t *testing.T, e *echo.Echo, equipmentID int, filename string, content []byte) *httptest.ResponseRecorder {
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
		"/api/equipments/"+itoa(equipmentID)+"/picture", &body)
	req.Header.Set(echo.HeaderContentType, w.FormDataContentType())
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func getPicture(e *echo.Echo, equipmentID int) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/api/equipments/"+itoa(equipmentID)+"/picture", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func equipmentPicture(t *testing.T, h *handlers.Handler, id int) *string {
	t.Helper()
	eq, err := db.GetEquipment(h.DB, id)
	if err != nil {
		t.Fatalf("GetEquipment: %v", err)
	}
	return eq.Picture
}

func TestEquipmentPicture_UploadServeReplaceDelete(t *testing.T) {
	e, h, baseDir := newTestServer(t)
	id := seedEquipment(t, h)

	png := pngBytes

	// Upload.
	rec := uploadPicture(t, e, id, "shot.png", png)
	if rec.Code != http.StatusOK {
		t.Fatalf("upload: expected 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	var info generated.FileInfo
	if err := json.Unmarshal(rec.Body.Bytes(), &info); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}
	if info.Name != "picture.png" {
		t.Errorf("stored name = %q, want picture.png", info.Name)
	}
	if info.Url != "/api/equipments/"+itoa(id)+"/picture" {
		t.Errorf("url = %q", info.Url)
	}

	// File on disk at the fixed path, and the column points at it.
	pngPath := filepath.Join(baseDir, "files", "equipments", itoa(id), "picture.png")
	if _, err := os.Stat(pngPath); err != nil {
		t.Fatalf("picture.png not on disk: %v", err)
	}
	if p := equipmentPicture(t, h, id); p == nil || *p != "files/equipments/"+itoa(id)+"/picture.png" {
		t.Errorf("equipment.picture = %v", p)
	}

	// Serve inline.
	getRec := getPicture(e, id)
	if getRec.Code != http.StatusOK {
		t.Fatalf("serve: expected 200, got %d", getRec.Code)
	}
	if !bytes.Equal(getRec.Body.Bytes(), png) {
		t.Errorf("served bytes differ from uploaded")
	}
	if cd := getRec.Header().Get("Content-Disposition"); cd != "inline" {
		t.Errorf("Content-Disposition = %q, want inline", cd)
	}

	// Replace with a JPEG — the old PNG file must be removed.
	jpeg := jpegBytes
	if rec := uploadPicture(t, e, id, "shot.jpg", jpeg); rec.Code != http.StatusOK {
		t.Fatalf("replace: expected 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(pngPath); !os.IsNotExist(err) {
		t.Errorf("old picture.png should be removed after replace")
	}
	jpgPath := filepath.Join(baseDir, "files", "equipments", itoa(id), "picture.jpg")
	if _, err := os.Stat(jpgPath); err != nil {
		t.Errorf("picture.jpg not on disk after replace: %v", err)
	}
	if p := equipmentPicture(t, h, id); p == nil || *p != "files/equipments/"+itoa(id)+"/picture.jpg" {
		t.Errorf("equipment.picture after replace = %v", p)
	}

	// Delete.
	delReq := httptest.NewRequest(http.MethodDelete, "/api/equipments/"+itoa(id)+"/picture", nil)
	delRec := httptest.NewRecorder()
	e.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("delete: expected 204, got %d", delRec.Code)
	}
	if _, err := os.Stat(jpgPath); !os.IsNotExist(err) {
		t.Errorf("picture file still on disk after delete")
	}
	if p := equipmentPicture(t, h, id); p != nil {
		t.Errorf("equipment.picture should be nil after delete, got %v", *p)
	}
	if getRec := getPicture(e, id); getRec.Code != http.StatusNotFound {
		t.Errorf("serve after delete: expected 404, got %d", getRec.Code)
	}
}

func TestEquipmentPicture_RejectsNonImage(t *testing.T) {
	e, h, _ := newTestServer(t)
	id := seedEquipment(t, h)

	rec := uploadPicture(t, e, id, "notes.txt", []byte("just some plain text, definitely not an image"))
	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415 for non-image, got %d (%s)", rec.Code, rec.Body.String())
	}
	if p := equipmentPicture(t, h, id); p != nil {
		t.Errorf("equipment.picture should stay nil after a rejected upload")
	}
}

func TestEquipmentPicture_UploadToMissingEquipment(t *testing.T) {
	e, _, _ := newTestServer(t)
	rec := uploadPicture(t, e, 999, "shot.png", pngBytes)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for missing equipment, got %d", rec.Code)
	}
}

func TestEquipmentPicture_ServeWhenNone(t *testing.T) {
	e, h, _ := newTestServer(t)
	id := seedEquipment(t, h)
	if rec := getPicture(e, id); rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 when no picture set, got %d", rec.Code)
	}
}

func TestEquipmentPicture_DeleteDir_CascadesPicture(t *testing.T) {
	e, h, baseDir := newTestServer(t)
	id := seedEquipment(t, h)

	uploadPicture(t, e, id, "shot.png", pngBytes)

	delReq := httptest.NewRequest(http.MethodDelete, "/api/equipments/"+itoa(id), nil)
	delRec := httptest.NewRecorder()
	e.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("delete equipment: expected 204, got %d", delRec.Code)
	}
	dir := filepath.Join(baseDir, "files", "equipments", itoa(id))
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Errorf("equipment dir (incl. picture) should be removed after equipment delete")
	}
}

func TestEquipment_IconDefaultsAndUpdates(t *testing.T) {
	_, h, _ := newTestServer(t)
	id := seedEquipment(t, h)

	// Default icon on create.
	eq, err := db.GetEquipment(h.DB, id)
	if err != nil {
		t.Fatalf("GetEquipment: %v", err)
	}
	if eq.Icon != "🔧" {
		t.Errorf("default icon = %q, want 🔧", eq.Icon)
	}

	// Custom icon survives an update.
	eq.Icon = "⛵"
	if err := db.UpdateEquipment(h.DB, eq); err != nil {
		t.Fatalf("UpdateEquipment: %v", err)
	}
	reloaded, _ := db.GetEquipment(h.DB, id)
	if reloaded.Icon != "⛵" {
		t.Errorf("icon after update = %q, want ⛵", reloaded.Icon)
	}

	// Clearing the icon falls back to the default.
	reloaded.Icon = ""
	if err := db.UpdateEquipment(h.DB, reloaded); err != nil {
		t.Fatalf("UpdateEquipment (clear): %v", err)
	}
	cleared, _ := db.GetEquipment(h.DB, id)
	if cleared.Icon != "🔧" {
		t.Errorf("icon after clear = %q, want 🔧", cleared.Icon)
	}
}
