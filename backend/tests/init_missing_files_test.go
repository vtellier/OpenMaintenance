package tests

import (
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

	dir := filepath.Dir(dbPath)
	for _, d := range docs {
		if err := db.CreateEquipmentFile(conn, &models.EquipmentFile{
			EquipmentID: eq.ID, FilePath: d.relPath, OriginalName: filepath.Base(d.relPath), UploadedAt: time.Now(),
		}); err != nil {
			t.Fatalf("CreateEquipmentFile: %v", err)
		}
		if d.onDisk {
			writeFile(t, filepath.Join(dir, filepath.FromSlash(d.relPath)), []byte("doc"))
		}
	}
	for _, p := range photos {
		if err := db.CreateInterventionFile(conn, &models.InterventionFile{
			InterventionID: inv.ID, FilePath: p.relPath, OriginalName: filepath.Base(p.relPath), UploadedAt: time.Now(),
		}); err != nil {
			t.Fatalf("CreateInterventionFile: %v", err)
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
