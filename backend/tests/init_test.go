package tests

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

func TestInitDB_NoBackupOnFirstRun(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "maintenance.db")
	backupDir := filepath.Join(dir, "backups")

	database, err := db.InitDB(dbPath, "test", db.BackupConfig{Enabled: true, Path: backupDir, Keep: 7})
	if err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	database.Close()

	if _, err := os.Stat(backupDir); !os.IsNotExist(err) {
		t.Error("backup dir should not be created on first run (no pre-existing DB)")
	}
}

func TestInitDB_BackupCreatedOnSecondRun(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "maintenance.db")
	backupDir := filepath.Join(dir, "backups")
	cfg := db.BackupConfig{Enabled: true, Path: backupDir, Keep: 7}

	// First run: creates the DB, then the app writes some data.
	database, err := db.InitDB(dbPath, "test", cfg)
	if err != nil {
		t.Fatalf("first InitDB: %v", err)
	}
	if err := db.CreateEquipment(database, &models.Equipment{Name: "Sailboat"}); err != nil {
		t.Fatalf("CreateEquipment: %v", err)
	}
	database.Close()

	// Second run: DB exists, so a backup must be created.
	database2, err := db.InitDB(dbPath, "test", cfg)
	if err != nil {
		t.Fatalf("second InitDB: %v", err)
	}
	database2.Close()

	// The backup must reflect the DB state left by the first run.
	entries, err := readBackupArchive(onlyBackup(t, backupDir))
	if err != nil {
		t.Fatalf("read archive: %v", err)
	}
	var name string
	if err := openArchivedDB(t, entries["maintenance.db"]).QueryRow(
		`SELECT name FROM equipments`).Scan(&name); err != nil {
		t.Fatalf("query archived db: %v", err)
	}
	if name != "Sailboat" {
		t.Errorf("archived equipment name = %q, want Sailboat", name)
	}
}

func TestInitDB_BackupDisabled(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "maintenance.db")
	backupDir := filepath.Join(dir, "backups")
	cfg := db.BackupConfig{Enabled: false, Path: backupDir, Keep: 7}

	for i := range 2 {
		database, err := db.InitDB(dbPath, "test", cfg)
		if err != nil {
			t.Fatalf("run %d InitDB: %v", i, err)
		}
		database.Close()
	}

	if _, err := os.Stat(backupDir); !os.IsNotExist(err) {
		t.Error("backup dir should not exist when backup is disabled")
	}
}
