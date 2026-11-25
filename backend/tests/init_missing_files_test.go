package tests

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

// attachedFile is one file the database references, and whether it is on disk.
type attachedFile struct {
	relPath string // files/..., relative to the database directory
	onDisk  bool
}

// seedAttachedFiles creates the database at dbPath (a first run, so no backup)
// with an equipment holding the given documents and an exceptional
// intervention holding the given photos, then writes to disk only the files
// marked onDisk.
func seedAttachedFiles(t *testing.T, dbPath string, docs, photos []attachedFile) {
	t.Helper()
	conn, err := db.InitDB(dbPath, "test", db.BackupConfig{})
	if err != nil {
		t.Fatalf("seed InitDB: %v", err)
	}
	defer conn.Close()

	eq := &models.Equipment{Name: "Sailboat"}
	if err := db.CreateEquipment(conn, eq); err != nil {
		t.Fatalf("CreateEquipment: %v", err)
	}
	label := "Rigging check"
	inv := &models.Intervention{EquipmentID: &eq.ID, ExceptionalLabel: &label, Date: time.Now()}
	if err := db.CreateIntervention(conn, inv); err != nil {
		t.Fatalf("CreateIntervention: %v", err)
	}

	// The rows are inserted directly: a row whose file is missing is a state
	// the app cannot produce through its own interface.
	dir := filepath.Dir(dbPath)
	for _, d := range docs {
		if _, err := conn.Exec(
			`INSERT INTO equipment_files (equipment_id, file_path, original_name, uploaded_at) VALUES (?, ?, ?, ?)`,
			eq.ID, d.relPath, filepath.Base(d.relPath), time.Now(),
		); err != nil {
			t.Fatalf("insert document row: %v", err)
		}
		if d.onDisk {
			writeFile(t, filepath.Join(dir, filepath.FromSlash(d.relPath)), []byte("doc"))
		}
	}
	for _, p := range photos {
		if _, err := conn.Exec(
			`INSERT INTO intervention_files (intervention_id, file_path, original_name, uploaded_at) VALUES (?, ?, ?, ?)`,
			inv.ID, p.relPath, filepath.Base(p.relPath), time.Now(),
		); err != nil {
			t.Fatalf("insert photo row: %v", err)
		}
		if p.onDisk {
			writeFile(t, filepath.Join(dir, filepath.FromSlash(p.relPath)), []byte("photo"))
		}
	}
}

func TestInitDB_RefusesWhenNoAttachedFileIsFound(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "maintenance.db")
	backupDir := filepath.Join(dir, "backups")
	seedAttachedFiles(t, dbPath,
		[]attachedFile{{"files/equipments/1/files/a.pdf", false}, {"files/equipments/1/files/b.pdf", false}},
		[]attachedFile{{"files/equipments/1/interventions/1/c.jpg", false}},
	)
	// An older backup that a restart loop must never rotate away.
	older := filepath.Join(backupDir, "maintenance.20200101-000000.tar.gz")
	writeFile(t, older, []byte("older backup"))

	conn, err := db.InitDB(dbPath, "test", db.BackupConfig{Enabled: true, Path: backupDir, Keep: 1})
	if err == nil {
		conn.Close()
		t.Fatal("InitDB succeeded, want a refusal: none of the attached files exist")
	}

	msg := err.Error()
	for _, want := range []string{dbPath, filepath.Join(dir, "files"), "3 attached files", "move the files/ folder"} {
		if !strings.Contains(msg, want) {
			t.Errorf("error %q does not mention %q", msg, want)
		}
	}
	if names := backupNames(t, backupDir); len(names) != 1 || names[0] != filepath.Base(older) {
		t.Errorf("backup dir = %v, want only the older backup, untouched", names)
	}
}

func TestInitDB_RefusalNamesASingleMissingFileInTheSingular(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "maintenance.db")
	seedAttachedFiles(t, dbPath, []attachedFile{{"files/equipments/1/files/a.pdf", false}}, nil)

	conn, err := db.InitDB(dbPath, "test", db.BackupConfig{})
	if err == nil {
		conn.Close()
		t.Fatal("InitDB succeeded, want a refusal: the only attached file is missing")
	}
	if want := "references 1 attached file, but it is not in " + filepath.Join(dir, "files"); !strings.Contains(err.Error(), want) {
		t.Errorf("error %q does not contain %q", err.Error(), want)
	}
}

// captureLog redirects the standard logger for the rest of the test.
func captureLog(t *testing.T) *strings.Builder {
	t.Helper()
	var buf strings.Builder
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(os.Stderr) })
	return &buf
}

func TestInitDB_StartsAndWarnsWhenSomeAttachedFilesAreMissing(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "maintenance.db")
	backupDir := filepath.Join(dir, "backups")
	seedAttachedFiles(t, dbPath,
		[]attachedFile{{"files/equipments/1/files/a.pdf", true}, {"files/equipments/1/files/b.pdf", false}},
		[]attachedFile{{"files/equipments/1/interventions/1/c.jpg", true}},
	)
	logs := captureLog(t)

	conn, err := db.InitDB(dbPath, "test", db.BackupConfig{Enabled: true, Path: backupDir, Keep: 7})
	if err != nil {
		t.Fatalf("InitDB: %v, want it to start with some files missing", err)
	}
	conn.Close()

	for _, want := range []string{"1 of 3 attached files", "files/equipments/1/files/b.pdf"} {
		if !strings.Contains(logs.String(), want) {
			t.Errorf("log %q does not mention %q", logs.String(), want)
		}
	}
	onlyBackup(t, backupDir)
}

func TestInitDB_StartsAsBeforeWhenNoAttachedFileIsReferenced(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "maintenance.db")
	backupDir := filepath.Join(dir, "backups")
	seedAttachedFiles(t, dbPath, nil, nil)
	logs := captureLog(t)

	conn, err := db.InitDB(dbPath, "test", db.BackupConfig{Enabled: true, Path: backupDir, Keep: 7})
	if err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	conn.Close()

	if strings.Contains(logs.String(), "warning") {
		t.Errorf("unexpected warning with no attached file referenced: %q", logs.String())
	}
	onlyBackup(t, backupDir)
}
