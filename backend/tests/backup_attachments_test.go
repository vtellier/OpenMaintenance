package tests

import (
	"archive/tar"
	"compress/gzip"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/generated"
)

// readBackupArchive returns the regular-file entries of a .tar.gz backup,
// keyed by their slash-separated path inside the archive. It refuses entries
// whose name is absolute or escapes the extraction directory, so a backup is
// always safe to extract into the database directory.
func readBackupArchive(path string) (map[string][]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return nil, err
	}
	defer gz.Close()

	entries := map[string][]byte{}
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			return entries, nil
		}
		if err != nil {
			return nil, err
		}
		if !filepath.IsLocal(filepath.FromSlash(hdr.Name)) {
			return nil, fmt.Errorf("unsafe entry name %q", hdr.Name)
		}
		if hdr.Typeflag != tar.TypeReg {
			continue
		}
		data, err := io.ReadAll(tr)
		if err != nil {
			return nil, err
		}
		entries[hdr.Name] = data
	}
}

func entryNames(entries map[string][]byte) []string {
	names := make([]string, 0, len(entries))
	for n := range entries {
		names = append(names, n)
	}
	sort.Strings(names)
	return names
}

// onlyBackup returns the path of the single file in backupDir.
func onlyBackup(t *testing.T, backupDir string) string {
	t.Helper()
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		t.Fatalf("read backup dir: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected exactly 1 backup in %s, got %d", backupDir, len(entries))
	}
	return filepath.Join(backupDir, entries[0].Name())
}

// openArchivedDB writes the archived database to a temp file and opens it.
func openArchivedDB(t *testing.T, data []byte) *sql.DB {
	t.Helper()
	path := filepath.Join(t.TempDir(), "restored.db")
	writeFile(t, path, data)
	conn, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatalf("open archived db: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return conn
}

// Non-regression for issue #27: a backup taken after an attachment was
// uploaded must hold that attachment next to the database, so a restore does
// not lose it.
func TestBackup_IncludesUploadedAttachment(t *testing.T) {
	e, h, baseDir := newTestServer(t)
	id := seedEquipment(t, h)

	content := []byte("%PDF-1.4 engine manual")
	rec := uploadDoc(t, e, id, "manual.pdf", content)
	if rec.Code != http.StatusCreated {
		t.Fatalf("upload: expected 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	var created generated.FileInfo
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}

	// Restart the app with backups enabled: the backup runs at startup.
	h.DB.Close()
	dbPath := filepath.Join(baseDir, "maintenance.db")
	backupDir := filepath.Join(baseDir, "backups")
	database, err := db.InitDB(dbPath, "test", db.BackupConfig{Enabled: true, Path: backupDir, Keep: 7})
	if err != nil {
		t.Fatalf("InitDB with backup: %v", err)
	}
	database.Close()

	backup := onlyBackup(t, backupDir)
	attachment := "files/equipments/" + itoa(id) + "/files/" + created.Name

	entries, err := readBackupArchive(backup)
	if err != nil {
		t.Fatalf("backup %s does not hold attachment %s: it cannot be read as a .tar.gz archive: %v",
			filepath.Base(backup), attachment, err)
	}
	got, ok := entries[attachment]
	if !ok {
		t.Fatalf("attachment %s missing from backup %s (archive holds %v)",
			attachment, filepath.Base(backup), entryNames(entries))
	}
	if string(got) != string(content) {
		t.Errorf("archived attachment content = %q, want %q", got, content)
	}

	// The archived database still references the attachment.
	dbData, ok := entries["maintenance.db"]
	if !ok {
		t.Fatalf("database missing from backup (archive holds %v)", entryNames(entries))
	}
	var n int
	if err := openArchivedDB(t, dbData).QueryRow(
		`SELECT COUNT(*) FROM equipment_files WHERE equipment_id = ?`, id).Scan(&n); err != nil {
		t.Fatalf("query archived db: %v", err)
	}
	if n != 1 {
		t.Errorf("archived db has %d equipment_files rows, want 1", n)
	}
}
