// Package filestore says where the data lives: the SQLite database, and the
// files/ directory next to it that holds attached files. What is under files/
// belongs to package attachments.
package filestore

import (
	"os"
	"path/filepath"
)

// ResolveDBPath returns the absolute database path. Relative paths are
// resolved against the executable's directory.
func ResolveDBPath(dbPath string) (string, error) {
	if filepath.IsAbs(dbPath) {
		return dbPath, nil
	}
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(exe), dbPath), nil
}

// BaseDir returns the directory that contains the files/ tree: the directory
// of the database. Every stored relative path (files/...) is relative to it.
func BaseDir(dbPath string) (string, error) {
	abs, err := ResolveDBPath(dbPath)
	if err != nil {
		return "", err
	}
	return filepath.Dir(abs), nil
}

// FilesDir returns the files/ directory under baseDir.
func FilesDir(baseDir string) string {
	return filepath.Join(baseDir, "files")
}

// EnsureFilesDir creates the files/ directory under baseDir if it is missing.
func EnsureFilesDir(baseDir string) error {
	return os.MkdirAll(FilesDir(baseDir), 0755)
}
