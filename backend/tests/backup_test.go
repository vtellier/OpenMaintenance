package tests

import (
	"database/sql"
	"os"
	"path/filepath"
	"regexp"
	"testing"

	"github.com/vtellier/OpenMaintenance/internal/db"
)

func writeFile(t *testing.T, path string, content []byte) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatalf("mkdir for %s: %v", path, err)
	}
	if err := os.WriteFile(path, content, 0644); err != nil {
		t.Fatalf("writeFile %s: %v", path, err)
	}
}

// writeSQLiteDB creates a real SQLite database at path holding one row with
// the given marker, so a backup's database can be checked for content.
func writeSQLiteDB(t *testing.T, path, marker string) {
	t.Helper()
	conn, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatalf("open %s: %v", path, err)
	}
	defer conn.Close()
	if _, err := conn.Exec(`CREATE TABLE marker (v TEXT)`); err != nil {
		t.Fatalf("create table: %v", err)
	}
	if _, err := conn.Exec(`INSERT INTO marker (v) VALUES (?)`, marker); err != nil {
		t.Fatalf("insert marker: %v", err)
	}
}

func archivedMarker(t *testing.T, dbData []byte) string {
	t.Helper()
	var v string
	if err := openArchivedDB(t, dbData).QueryRow(`SELECT v FROM marker`).Scan(&v); err != nil {
		t.Fatalf("read marker from archived db: %v", err)
	}
	return v
}

func backupNames(t *testing.T, dir string) []string {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read backup dir: %v", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	return names
}

func assertExists(t *testing.T, path string, want bool) {
	t.Helper()
	_, err := os.Stat(path)
	if exists := err == nil; exists != want {
		t.Errorf("%s: exists=%v, want %v", filepath.Base(path), exists, want)
	}
}

var archiveName = regexp.MustCompile(`^maintenance\.\d{8}-\d{6}\.tar\.gz$`)

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

func TestBackupDB_ArchivesDatabaseAndFiles(t *testing.T) {
	dir := t.TempDir()
	dbFile := filepath.Join(dir, "maintenance.db")
	writeSQLiteDB(t, dbFile, "before backup")
	writeFile(t, filepath.Join(dir, "files", "equipments", "3", "files", "a.pdf"), []byte("manual"))
	writeFile(t, filepath.Join(dir, "files", "equipments", "3", "interventions", "9", "b.jpg"), []byte("photo"))
	backupDir := filepath.Join(dir, "backups")

	if err := db.BackupDB(dbFile, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 7}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	backup := onlyBackup(t, backupDir) // also proves no temp file is left behind
	if !archiveName.MatchString(filepath.Base(backup)) {
		t.Errorf("unexpected backup filename: %s", filepath.Base(backup))
	}

	entries, err := readBackupArchive(backup)
	if err != nil {
		t.Fatalf("read archive: %v", err)
	}
	want := map[string]string{
		"files/equipments/3/files/a.pdf":           "manual",
		"files/equipments/3/interventions/9/b.jpg": "photo",
	}
	for name, content := range want {
		if got, ok := entries[name]; !ok || string(got) != content {
			t.Errorf("archive entry %s = %q (present=%v), want %q", name, got, ok, content)
		}
	}
	if len(entries) != len(want)+1 {
		t.Errorf("archive holds %v, want the database and %d files", entryNames(entries), len(want))
	}
	if got := archivedMarker(t, entries["maintenance.db"]); got != "before backup" {
		t.Errorf("archived db marker = %q, want %q", got, "before backup")
	}
}

// A database without a files/ directory (fresh install, no attachment yet)
// is backed up on its own.
func TestBackupDB_NoFilesDirectory(t *testing.T) {
	dir := t.TempDir()
	dbFile := filepath.Join(dir, "maintenance.db")
	writeSQLiteDB(t, dbFile, "no files")
	backupDir := filepath.Join(dir, "backups")

	if err := db.BackupDB(dbFile, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 7}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	entries, err := readBackupArchive(onlyBackup(t, backupDir))
	if err != nil {
		t.Fatalf("read archive: %v", err)
	}
	if len(entries) != 1 {
		t.Errorf("archive holds %v, want only maintenance.db", entryNames(entries))
	}
	if got := archivedMarker(t, entries["maintenance.db"]); got != "no files" {
		t.Errorf("archived db marker = %q, want %q", got, "no files")
	}
}

// files/ may be a symlink to another volume; its content is still archived
// under files/.
func TestBackupDB_FollowsSymlinkedFilesDir(t *testing.T) {
	dir := t.TempDir()
	dbFile := filepath.Join(dir, "maintenance.db")
	writeSQLiteDB(t, dbFile, "x")
	volume := t.TempDir()
	writeFile(t, filepath.Join(volume, "equipments", "1", "files", "a.pdf"), []byte("manual"))
	if err := os.Symlink(volume, filepath.Join(dir, "files")); err != nil {
		t.Skipf("symlinks not supported: %v", err)
	}
	backupDir := filepath.Join(dir, "backups")

	if err := db.BackupDB(dbFile, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 7}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	entries, err := readBackupArchive(onlyBackup(t, backupDir))
	if err != nil {
		t.Fatalf("read archive: %v", err)
	}
	if got := string(entries["files/equipments/1/files/a.pdf"]); got != "manual" {
		t.Errorf("archive holds %v, want files/equipments/1/files/a.pdf = manual", entryNames(entries))
	}
}

// A backup killed mid-way leaves its temporary directory behind; the next
// backup removes it.
func TestBackupDB_SweepsInterruptedBackup(t *testing.T) {
	dir := t.TempDir()
	dbFile := filepath.Join(dir, "maintenance.db")
	writeSQLiteDB(t, dbFile, "x")
	backupDir := filepath.Join(dir, "backups")
	stale := filepath.Join(backupDir, ".tmp-backup-123")
	writeFile(t, filepath.Join(stale, "maintenance.db"), []byte("partial snapshot"))

	if err := db.BackupDB(dbFile, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 7}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertExists(t, stale, false)
	if !archiveName.MatchString(filepath.Base(onlyBackup(t, backupDir))) {
		t.Errorf("expected only the new archive, got %v", backupNames(t, backupDir))
	}
}

// A backup directory configured inside files/ must not be archived into
// itself.
func TestBackupDB_SkipsBackupDirInsideFiles(t *testing.T) {
	dir := t.TempDir()
	dbFile := filepath.Join(dir, "maintenance.db")
	writeSQLiteDB(t, dbFile, "x")
	writeFile(t, filepath.Join(dir, "files", "doc.txt"), []byte("doc"))
	backupDir := filepath.Join(dir, "files", "backups")
	writeFile(t, filepath.Join(backupDir, "maintenance.20200101-000001.tar.gz"), []byte("old"))

	if err := db.BackupDB(dbFile, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 7}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for _, name := range backupNames(t, backupDir) {
		if name == "maintenance.20200101-000001.tar.gz" {
			continue
		}
		entries, err := readBackupArchive(filepath.Join(backupDir, name))
		if err != nil {
			t.Fatalf("read archive %s: %v", name, err)
		}
		if _, ok := entries["files/doc.txt"]; !ok || len(entries) != 2 {
			t.Errorf("archive holds %v, want maintenance.db and files/doc.txt only", entryNames(entries))
		}
	}
}

func TestBackupDB_Rotation(t *testing.T) {
	dir := t.TempDir()
	dbFile := filepath.Join(dir, "maintenance.db")
	writeSQLiteDB(t, dbFile, "x")
	backupDir := filepath.Join(dir, "backups")

	// Pre-seed 3 old backups with past timestamps (lexicographically smaller than today).
	for _, ts := range []string{"20200101-000001", "20200101-000002", "20200101-000003"} {
		writeFile(t, filepath.Join(backupDir, "maintenance."+ts+".tar.gz"), []byte("old"))
	}

	// One more run: total becomes 4, rotation with keep=3 removes the oldest.
	if err := db.BackupDB(dbFile, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 3}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if names := backupNames(t, backupDir); len(names) != 3 {
		t.Errorf("expected 3 backups after rotation, got %v", names)
	}
	assertExists(t, filepath.Join(backupDir, "maintenance.20200101-000001.tar.gz"), false)
	assertExists(t, filepath.Join(backupDir, "maintenance.20200101-000002.tar.gz"), true)
}

// Legacy .bak copies from older releases are kept on upgrade and count toward
// keep together with the new archives, so they age out oldest first.
func TestBackupDB_RotationAgesOutLegacyBak(t *testing.T) {
	seed := func(t *testing.T, names ...string) (dbFile, backupDir string) {
		dir := t.TempDir()
		dbFile = filepath.Join(dir, "maintenance.db")
		writeSQLiteDB(t, dbFile, "x")
		backupDir = filepath.Join(dir, "backups")
		for _, name := range names {
			writeFile(t, filepath.Join(backupDir, name), []byte("old"))
		}
		return dbFile, backupDir
	}
	legacy := []string{
		"maintenance.20200101-000001.bak",
		"maintenance.20200101-000002.bak",
		"maintenance.20200101-000003.bak",
	}

	t.Run("under the limit, the upgrade deletes nothing", func(t *testing.T) {
		dbFile, backupDir := seed(t, legacy...)
		if err := db.BackupDB(dbFile, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 4}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for _, name := range legacy {
			assertExists(t, filepath.Join(backupDir, name), true)
		}
		if names := backupNames(t, backupDir); len(names) != 4 {
			t.Errorf("expected 3 legacy backups + 1 archive, got %v", names)
		}
	})

	t.Run("over the limit, the oldest go first whatever their format", func(t *testing.T) {
		newer := "maintenance.20210101-000000.tar.gz"
		dbFile, backupDir := seed(t, append(legacy, newer)...)
		if err := db.BackupDB(dbFile, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 3}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		assertExists(t, filepath.Join(backupDir, legacy[0]), false)
		assertExists(t, filepath.Join(backupDir, legacy[1]), false)
		assertExists(t, filepath.Join(backupDir, legacy[2]), true)
		assertExists(t, filepath.Join(backupDir, newer), true)
		if names := backupNames(t, backupDir); len(names) != 3 {
			t.Errorf("expected 3 backups after rotation, got %v", names)
		}
	})
}

// Rotation only deletes files named exactly <stem>.<timestamp>.<ext>.
func TestBackupDB_RotationIgnoresUnrecognisedFiles(t *testing.T) {
	dir := t.TempDir()
	dbFile := filepath.Join(dir, "maintenance.db")
	writeSQLiteDB(t, dbFile, "x")
	backupDir := filepath.Join(dir, "backups")
	others := []string{
		"notes.bak",
		"maintenance.bak",
		"maintenance.old.bak",
		"other.20200101-000001.tar.gz",
		"maintenance.20200101-000001.txt",
	}
	for _, name := range others {
		writeFile(t, filepath.Join(backupDir, name), []byte("keep me"))
	}

	if err := db.BackupDB(dbFile, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 1}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, name := range others {
		assertExists(t, filepath.Join(backupDir, name), true)
	}
}

func TestBackupDB_KeepZero_NoRotation(t *testing.T) {
	dir := t.TempDir()
	dbFile := filepath.Join(dir, "maintenance.db")
	writeSQLiteDB(t, dbFile, "x")
	backupDir := filepath.Join(dir, "backups")

	for _, ts := range []string{"20200101-000001", "20200101-000002", "20200101-000003", "20200101-000004"} {
		writeFile(t, filepath.Join(backupDir, "maintenance."+ts+".bak"), []byte("old"))
	}

	if err := db.BackupDB(dbFile, db.BackupConfig{Enabled: true, Path: backupDir, Keep: 0}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if names := backupNames(t, backupDir); len(names) != 5 {
		t.Errorf("expected 5 backups with keep=0 (no rotation), got %v", names)
	}
}
