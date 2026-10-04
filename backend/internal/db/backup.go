package db

import (
	"archive/tar"
	"compress/gzip"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type BackupConfig struct {
	Enabled bool
	Path    string
	Keep    int
}

const (
	// BackupArchiveExt is the extension of a backup archive holding the
	// database and the files/ tree.
	BackupArchiveExt = ".tar.gz"
	// LegacyBackupExt is the extension of the database-only copies written by
	// older releases. They are listed and rotated, never written.
	LegacyBackupExt = ".bak"

	backupTimestampLayout = "20060102-150405"
	tmpBackupPrefix       = ".tmp-backup-"
)

// Backup is one backup found in the backup directory.
type Backup struct {
	Name      string
	Path      string
	Size      int64
	CreatedAt time.Time // from the timestamp in the name, or the file's mtime
}

// BackupDB archives the database and the files/ directory next to it into
// cfg.Path/<stem>.<timestamp>.tar.gz, then rotates old backups.
//
// It must run before the app opens the database and starts serving, so that
// the backup holds the pre-migration state and nothing changes the database or
// the files while the archive is written. Does nothing when backup is disabled
// or the DB file does not yet exist.
func BackupDB(dbPath string, cfg BackupConfig) error {
	if !cfg.Enabled {
		return nil
	}
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		return nil // first run, nothing to back up
	}

	backupDir := cfg.Path
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return fmt.Errorf("backup: cannot create backup directory: %w", err)
	}

	base := filepath.Base(dbPath)
	stem := strings.TrimSuffix(base, filepath.Ext(base))
	ts := time.Now().Format(backupTimestampLayout)
	backupPath := filepath.Join(backupDir, stem+"."+ts+BackupArchiveExt)

	// Work in a temporary directory inside the backup directory so the final
	// rename is atomic: an interrupted backup never leaves a truncated archive
	// that rotation would count as a valid backup. Leftovers from a run killed
	// mid-backup are swept first.
	stale, _ := filepath.Glob(filepath.Join(backupDir, tmpBackupPrefix+"*"))
	for _, s := range stale {
		os.RemoveAll(s)
	}
	tmpDir, err := os.MkdirTemp(backupDir, tmpBackupPrefix)
	if err != nil {
		return fmt.Errorf("backup: cannot create temporary directory: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	snapshot := filepath.Join(tmpDir, base)
	if err := snapshotDB(dbPath, snapshot); err != nil {
		return fmt.Errorf("backup: database snapshot failed: %w", err)
	}

	tmpArchive := filepath.Join(tmpDir, "backup"+BackupArchiveExt)
	filesDir := filepath.Join(filepath.Dir(dbPath), "files") // see doc/file-storage.md
	if err := writeArchive(tmpArchive, snapshot, base, filesDir, backupDir); err != nil {
		return fmt.Errorf("backup: archive failed: %w", err)
	}
	if err := os.Rename(tmpArchive, backupPath); err != nil {
		return fmt.Errorf("backup: cannot move archive into place: %w", err)
	}

	log.Printf("backup created: %s", backupPath)

	// The new backup is in place: failing to delete an old one must not keep
	// the app from starting.
	if cfg.Keep > 0 {
		if err := rotate(backupDir, stem, cfg.Keep); err != nil {
			log.Printf("backup: rotation failed: %v", err)
		}
	}
	return nil
}

// snapshotDB writes a consistent copy of the database at src to dst with
// VACUUM INTO. Opening the database through SQLite first rolls back a hot
// journal left by a crashed run, which a raw file copy would miss.
func snapshotDB(src, dst string) error {
	conn, err := sql.Open("sqlite3", src)
	if err != nil {
		return err
	}
	defer conn.Close()
	_, err = conn.Exec(`VACUUM INTO ?`, dst)
	return err
}

// writeArchive writes a .tar.gz at dst holding the database snapshot under
// dbName and, when it exists, the filesDir tree under "files/". Directories
// equal to skipDir (the backup directory, should it live inside files/) are
// left out, as is anything that is neither a regular file nor a directory.
func writeArchive(dst, snapshot, dbName, filesDir, skipDir string) (err error) {
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := out.Close(); err == nil {
			err = cerr
		}
	}()

	gz := gzip.NewWriter(out)
	tw := tar.NewWriter(gz)

	if err := addFileToArchive(tw, snapshot, dbName); err != nil {
		return err
	}
	if err := addFilesTree(tw, filesDir, skipDir); err != nil {
		return err
	}

	if err := tw.Close(); err != nil {
		return err
	}
	if err := gz.Close(); err != nil {
		return err
	}
	return out.Sync()
}

func addFilesTree(tw *tar.Writer, filesDir, skipDir string) error {
	if _, err := os.Lstat(filesDir); errors.Is(err, fs.ErrNotExist) {
		return nil // no attachment uploaded yet
	}
	// files/ may be a symlink to another volume; WalkDir does not follow a
	// symlinked root, so walk its target. A dangling link is an error, not
	// "no attachments".
	root, err := filepath.EvalSymlinks(filesDir)
	if err != nil {
		return err
	}
	absSkip := skipDir
	if resolved, err := filepath.EvalSymlinks(skipDir); err == nil {
		absSkip = resolved
	}
	absSkip, _ = filepath.Abs(absSkip)

	return filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		name := "files"
		if rel != "." {
			name += "/" + filepath.ToSlash(rel)
		}

		switch {
		case d.IsDir():
			if abs, _ := filepath.Abs(path); abs == absSkip {
				return filepath.SkipDir
			}
			info, err := d.Info()
			if err != nil {
				return err
			}
			return tw.WriteHeader(&tar.Header{
				Typeflag: tar.TypeDir,
				Name:     name + "/",
				Mode:     int64(info.Mode().Perm()),
				ModTime:  info.ModTime(),
			})
		case d.Type().IsRegular():
			return addFileToArchive(tw, path, name)
		default: // symlinks, sockets, ...: never created by the app
			log.Printf("backup: skipping %s (not a regular file)", path)
			return nil
		}
	})
}

func addFileToArchive(tw *tar.Writer, path, name string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return err
	}
	if err := tw.WriteHeader(&tar.Header{
		Typeflag: tar.TypeReg,
		Name:     name,
		Mode:     int64(info.Mode().Perm()),
		Size:     info.Size(),
		ModTime:  info.ModTime(),
	}); err != nil {
		return err
	}
	_, err = io.Copy(tw, f)
	return err
}

// ListBackups returns the backups in dir, newest first: .tar.gz archives and
// legacy .bak database copies. A missing directory yields an empty list.
func ListBackups(dir string) ([]Backup, error) {
	entries, err := os.ReadDir(dir)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var backups []Backup
	for _, e := range entries {
		name := e.Name()
		ext := backupExt(name)
		if ext == "" || strings.HasPrefix(name, ".") || !e.Type().IsRegular() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue // removed meanwhile
		}
		backups = append(backups, Backup{
			Name:      name,
			Path:      filepath.Join(dir, name),
			Size:      info.Size(),
			CreatedAt: backupTime(name, ext, info.ModTime()),
		})
	}

	sort.SliceStable(backups, func(i, j int) bool {
		if !backups[i].CreatedAt.Equal(backups[j].CreatedAt) {
			return backups[i].CreatedAt.After(backups[j].CreatedAt)
		}
		return backups[i].Name > backups[j].Name
	})
	return backups, nil
}

// backupExt returns the backup extension of name, or "" if it is not a backup.
func backupExt(name string) string {
	for _, ext := range []string{BackupArchiveExt, LegacyBackupExt} {
		if strings.HasSuffix(name, ext) {
			return ext
		}
	}
	return ""
}

// backupTime parses the timestamp embedded in a backup name
// (<stem>.<YYYYMMDD-HHMMSS><ext>) and falls back to the file's mtime.
func backupTime(name, ext string, fallback time.Time) time.Time {
	trimmed := strings.TrimSuffix(name, ext)
	if i := strings.LastIndex(trimmed, "."); i >= 0 {
		if t, err := time.Parse(backupTimestampLayout, trimmed[i+1:]); err == nil {
			return t
		}
	}
	return fallback
}

// rotate keeps the newest keep backups of the database named stem, archives
// and legacy .bak copies together, and deletes the rest. Only files named
// exactly <stem>.<YYYYMMDD-HHMMSS><ext> are considered, so nothing the app did
// not write is ever deleted.
func rotate(dir, stem string, keep int) error {
	backups, err := ListBackups(dir)
	if err != nil {
		return err
	}
	var mine []Backup
	for _, b := range backups {
		if isBackupOf(b.Name, stem) {
			mine = append(mine, b)
		}
	}
	var errs []error
	for len(mine) > keep {
		oldest := mine[len(mine)-1]
		if err := os.Remove(oldest.Path); err != nil {
			errs = append(errs, err)
		}
		mine = mine[:len(mine)-1]
	}
	return errors.Join(errs...)
}

// isBackupOf reports whether name is <stem>.<YYYYMMDD-HHMMSS><ext>.
func isBackupOf(name, stem string) bool {
	ext := backupExt(name)
	if ext == "" || !strings.HasPrefix(name, stem+".") {
		return false
	}
	ts := strings.TrimSuffix(strings.TrimPrefix(name, stem+"."), ext)
	_, err := time.Parse(backupTimestampLayout, ts)
	return err == nil
}
