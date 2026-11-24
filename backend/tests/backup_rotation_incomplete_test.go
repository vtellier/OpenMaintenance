package tests

import (
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/vtellier/OpenMaintenance/internal/db"
)

// An incomplete backup (the database references attached files that are not
// on disk) must never rotate away a complete one (issue #123).

// olderBackups writes two older archives of maintenance.db into backupDir and
// returns their names, oldest first.
func olderBackups(t *testing.T, backupDir string) []string {
	t.Helper()
	names := []string{"maintenance.20200101-000000.tar.gz", "maintenance.20200102-000000.tar.gz"}
	for _, n := range names {
		writeFile(t, filepath.Join(backupDir, n), []byte("older complete backup"))
	}
	return names
}

func TestBackupDB_IncompleteBackupLeavesOlderBackupsUntouched(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "maintenance.db")
	backupDir := filepath.Join(dir, "backups")
	seedAttachedFiles(t, dbPath,
		[]attachedFile{{"files/equipments/1/files/a.pdf", true}, {"files/equipments/1/files/b.pdf", false}},
		[]attachedFile{{"files/equipments/1/interventions/1/c.jpg", false}},
	)
	older := olderBackups(t, backupDir)
	logs := captureLog(t)

	if err := db.BackupDB(dbPath, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 2}); err != nil {
		t.Fatalf("BackupDB: %v", err)
	}

	names := backupNames(t, backupDir)
	if len(names) != 3 {
		t.Errorf("backup dir = %v, want the new archive and both older backups", names)
	}
	for _, n := range older {
		if !slices.Contains(names, n) {
			t.Errorf("older backup %s was rotated away by an incomplete backup", n)
		}
	}
	for _, want := range []string{"2 attached files", "rotation skipped"} {
		if !strings.Contains(logs.String(), want) {
			t.Errorf("log %q does not mention %q", logs.String(), want)
		}
	}
}

func TestBackupDB_CompleteBackupRotates(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "maintenance.db")
	backupDir := filepath.Join(dir, "backups")
	seedAttachedFiles(t, dbPath,
		[]attachedFile{{"files/equipments/1/files/a.pdf", true}},
		[]attachedFile{{"files/equipments/1/interventions/1/c.jpg", true}},
	)
	older := olderBackups(t, backupDir)

	if err := db.BackupDB(dbPath, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 2}); err != nil {
		t.Fatalf("BackupDB: %v", err)
	}

	names := backupNames(t, backupDir)
	if len(names) != 2 || slices.Contains(names, older[0]) || !slices.Contains(names, older[1]) {
		t.Errorf("backup dir = %v, want the new archive and %s (oldest rotated away)", names, older[1])
	}
}
