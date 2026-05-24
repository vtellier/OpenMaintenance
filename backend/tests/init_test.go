package tests

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/vtellier/OpenMaintenance/internal/db"
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

	// First run: creates the DB.
	database, err := db.InitDB(dbPath, "test", cfg)
	if err != nil {
		t.Fatalf("first InitDB: %v", err)
	}
	database.Close()

	// Capture the DB size after full initialization (post-migration).
	stat, err := os.Stat(dbPath)
	if err != nil {
		t.Fatalf("stat db: %v", err)
	}
	sizeAfterInit := stat.Size()

	// Second run: DB exists, so a backup must be created.
	database2, err := db.InitDB(dbPath, "test", cfg)
	if err != nil {
		t.Fatalf("second InitDB: %v", err)
	}
	database2.Close()

	entries, err := os.ReadDir(backupDir)
	if err != nil {
		t.Fatalf("backup dir not created: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 backup, got %d", len(entries))
	}

	// The backup must reflect the DB state captured before this second InitDB ran.
	backupStat, _ := os.Stat(filepath.Join(backupDir, entries[0].Name()))
	if backupStat.Size() != sizeAfterInit {
		t.Errorf("backup size %d != expected %d", backupStat.Size(), sizeAfterInit)
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
