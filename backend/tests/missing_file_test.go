package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/generated"
)

// A file whose row exists but whose bytes are gone from disk (issue #122).

func byOriginalName(files []generated.FileInfo) map[string]generated.FileInfo {
	m := map[string]generated.FileInfo{}
	for _, f := range files {
		m[f.OriginalName] = f
	}
	return m
}

func decodeFile(t *testing.T, rec *httptest.ResponseRecorder) generated.FileInfo {
	t.Helper()
	if rec.Code != http.StatusCreated {
		t.Fatalf("upload: expected 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	var f generated.FileInfo
	if err := json.Unmarshal(rec.Body.Bytes(), &f); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}
	return f
}

func removeFromDisk(t *testing.T, path string) {
	t.Helper()
	if err := os.Remove(path); err != nil {
		t.Fatalf("remove %s: %v", path, err)
	}
}

func request(e *echo.Echo, method, url string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(method, url, nil))
	return rec
}

func TestEquipmentFile_ListReportsAMissingDocument(t *testing.T) {
	e, h, baseDir := newTestServer(t)
	id := seedEquipment(t, h)
	decodeFile(t, uploadDoc(t, e, id, "manual.pdf", []byte("twelve bytes")))
	gone := decodeFile(t, uploadDoc(t, e, id, "invoice.pdf", []byte("invoice")))
	removeFromDisk(t, filepath.Join(baseDir, "files", "equipments", itoa(id), "files", gone.Name))

	docs := byOriginalName(listDocs(t, e, id))

	if d := docs["manual.pdf"]; d.Missing || d.Size != 12 {
		t.Errorf("present document: missing=%v size=%d, want missing=false size=12", d.Missing, d.Size)
	}
	if d := docs["invoice.pdf"]; !d.Missing || d.Size != 0 {
		t.Errorf("absent document: missing=%v size=%d, want missing=true size=0", d.Missing, d.Size)
	}
	if rec := request(e, http.MethodGet, "/api/equipments/"+itoa(id)+"/files/"+gone.Name); rec.Code != http.StatusNotFound {
		t.Errorf("serve absent document: got %d, want 404", rec.Code)
	}
}

func listPhotoFiles(t *testing.T, e *echo.Echo, interventionID int) []generated.FileInfo {
	t.Helper()
	rec := request(e, http.MethodGet, "/api/interventions/"+itoa(interventionID)+"/files")
	if rec.Code != http.StatusOK {
		t.Fatalf("list photos: expected 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	var files []generated.FileInfo
	if err := json.Unmarshal(rec.Body.Bytes(), &files); err != nil {
		t.Fatalf("decode photos list: %v", err)
	}
	return files
}

func TestInterventionFile_ListReportsAMissingPhoto(t *testing.T) {
	e, h, baseDir := newTestServer(t)
	eqID := seedEquipment(t, h)
	invID := seedIntervention(t, h, eqID, seedTask(t, h, eqID))
	decodeFile(t, uploadPhoto(t, e, invID, "before.png", pngBytes))
	gone := decodeFile(t, uploadPhoto(t, e, invID, "after.png", pngBytes))
	removeFromDisk(t, filepath.Join(interventionPhotoDir(baseDir, eqID, invID), gone.Name))

	photos := byOriginalName(listPhotoFiles(t, e, invID))

	if p := photos["before.png"]; p.Missing || p.Size != int64(len(pngBytes)) {
		t.Errorf("present photo: missing=%v size=%d, want missing=false size=%d", p.Missing, p.Size, len(pngBytes))
	}
	if p := photos["after.png"]; !p.Missing || p.Size != 0 {
		t.Errorf("absent photo: missing=%v size=%d, want missing=true size=0", p.Missing, p.Size)
	}
	if rec := request(e, http.MethodGet, "/api/interventions/"+itoa(invID)+"/files/"+gone.Name); rec.Code != http.StatusNotFound {
		t.Errorf("serve absent photo: got %d, want 404", rec.Code)
	}
}

func TestMissingFile_CanStillBeDeleted(t *testing.T) {
	t.Run("document", func(t *testing.T) {
		e, h, baseDir := newTestServer(t)
		id := seedEquipment(t, h)
		gone := decodeFile(t, uploadDoc(t, e, id, "invoice.pdf", []byte("invoice")))
		removeFromDisk(t, filepath.Join(baseDir, "files", "equipments", itoa(id), "files", gone.Name))

		if rec := request(e, http.MethodDelete, "/api/equipments/"+itoa(id)+"/files/"+gone.Name); rec.Code != http.StatusNoContent {
			t.Fatalf("delete missing document: got %d (%s), want 204", rec.Code, rec.Body.String())
		}
		if docs := listDocs(t, e, id); len(docs) != 0 {
			t.Errorf("after delete: %d documents listed, want 0", len(docs))
		}
	})
	t.Run("photo", func(t *testing.T) {
		e, h, baseDir := newTestServer(t)
		eqID := seedEquipment(t, h)
		invID := seedIntervention(t, h, eqID, seedTask(t, h, eqID))
		gone := decodeFile(t, uploadPhoto(t, e, invID, "after.png", pngBytes))
		removeFromDisk(t, filepath.Join(interventionPhotoDir(baseDir, eqID, invID), gone.Name))

		if rec := request(e, http.MethodDelete, "/api/interventions/"+itoa(invID)+"/files/"+gone.Name); rec.Code != http.StatusNoContent {
			t.Fatalf("delete missing photo: got %d (%s), want 204", rec.Code, rec.Body.String())
		}
		if photos := listPhotoFiles(t, e, invID); len(photos) != 0 {
			t.Errorf("after delete: %d photos listed, want 0", len(photos))
		}
	})
}
