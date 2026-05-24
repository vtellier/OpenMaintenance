package tests

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/vtellier/OpenMaintenance/internal/db"
)

func writeFile(t *testing.T, path string, content []byte) {
	t.Helper()
	if err := os.WriteFile(path, content, 0644); err != nil {
		t.Fatalf("writeFile %s: %v", path, err)
	}
}

func TestBackupDB_Disabled(t *testing.T) {
	dir := t.TempDir()
	dbFile := filepath.Join(dir, "maintenance.db")
	writeFile(t, dbFile, []byte("fake"))

	if err := db.BackupDB(dbFile, db.BackupConfig{Enabled: false, Path: dir, Keep: 7}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 1 {
		t.Errorf("expected no backup when disabled, got %d extra files", len(entries)-1)
	}
}

func TestBackupDB_FirstRun(t *testing.T) {
	dir := t.TempDir()
	backupDir := filepath.Join(dir, "backups")

	err := db.BackupDB(filepath.Join(dir, "nonexistent.db"), db.BackupConfig{Enabled: true, Path: backupDir, Keep: 7})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := os.Stat(backupDir); !os.IsNotExist(err) {
		t.Error("backup dir should not be created when source DB does not exist")
	}
}

func TestBackupDB_CreatesBackup(t *testing.T) {
	dir := t.TempDir()
	dbFile := filepath.Join(dir, "maintenance.db")
	content := []byte("fake db content")
	writeFile(t, dbFile, content)
	backupDir := filepath.Join(dir, "backups")

	if err := db.BackupDB(dbFile, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 7}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	entries, err := os.ReadDir(backupDir)
	if err != nil {
		t.Fatalf("backup dir not created: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 backup file, got %d", len(entries))
	}

	name := entries[0].Name()
	if !strings.HasPrefix(name, "maintenance.") || !strings.HasSuffix(name, ".bak") {
		t.Errorf("unexpected backup filename: %s", name)
	}

	backed, _ := os.ReadFile(filepath.Join(backupDir, name))
	if string(backed) != string(content) {
		t.Error("backup content does not match source")
	}
}

func TestBackupDB_Rotation(t *testing.T) {
	dir := t.TempDir()
	dbFile := filepath.Join(dir, "maintenance.db")
	writeFile(t, dbFile, []byte("content"))
	backupDir := filepath.Join(dir, "backups")
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Pre-seed 3 old backups with past timestamps (lexicographically smaller than today).
	oldTimestamps := []string{"20200101-000001", "20200101-000002", "20200101-000003"}
	for _, ts := range oldTimestamps {
		writeFile(t, filepath.Join(backupDir, "maintenance."+ts+".bak"), []byte("old"))
	}

	// One more run: total becomes 4, rotation with keep=3 removes the oldest.
	if err := db.BackupDB(dbFile, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 3}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	entries, _ := os.ReadDir(backupDir)
	if len(entries) != 3 {
		t.Errorf("expected 3 backups after rotation, got %d", len(entries))
	}
	oldest := filepath.Join(backupDir, "maintenance.20200101-000001.bak")
	if _, err := os.Stat(oldest); !os.IsNotExist(err) {
		t.Error("oldest backup should have been deleted by rotation")
	}
}

func TestBackupDB_KeepZero_NoRotation(t *testing.T) {
	dir := t.TempDir()
	dbFile := filepath.Join(dir, "maintenance.db")
	writeFile(t, dbFile, []byte("content"))
	backupDir := filepath.Join(dir, "backups")
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		t.Fatal(err)
	}

	oldTimestamps := []string{"20200101-000001", "20200101-000002", "20200101-000003", "20200101-000004"}
	for _, ts := range oldTimestamps {
		writeFile(t, filepath.Join(backupDir, "maintenance."+ts+".bak"), []byte("old"))
	}

	if err := db.BackupDB(dbFile, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 0}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	entries, _ := os.ReadDir(backupDir)
	if len(entries) != 5 {
		t.Errorf("expected 5 backups with keep=0 (no rotation), got %d", len(entries))
	}
}
