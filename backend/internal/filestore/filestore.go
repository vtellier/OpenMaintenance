// Package filestore resolves on-disk locations for attached files and keeps
// the files/ directory tree in sync with the database. Files live in a
// files/ directory next to the SQLite database; the database stores only
// relative paths (e.g. files/equipments/12/files/abc123.pdf).
package filestore

import (
	"io"
	"os"
	"path/filepath"
	"strconv"
)

// MaxDocumentSize is the largest equipment document accepted, in bytes
// (50 MB): enough for real equipment manuals, which run to tens of MB.
const MaxDocumentSize = 50 << 20

// MaxImageSize is the largest photo accepted for tasks and interventions, in
// bytes (10 MB).
const MaxImageSize = 10 << 20

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

// EquipmentFilesRelDir is the relative directory holding an equipment's
// documents, e.g. files/equipments/12/files.
func EquipmentFilesRelDir(equipmentID int) string {
	return filepath.ToSlash(filepath.Join("files", "equipments", strconv.Itoa(equipmentID), "files"))
}

// EquipmentRelDir is the relative directory holding everything for one
// equipment, e.g. files/equipments/12.
func EquipmentRelDir(equipmentID int) string {
	return filepath.ToSlash(filepath.Join("files", "equipments", strconv.Itoa(equipmentID)))
}

// InterventionFilesRelDir is the relative directory holding one intervention's
// photos, e.g. files/equipments/12/interventions/42.
func InterventionFilesRelDir(equipmentID, interventionID int) string {
	return filepath.ToSlash(filepath.Join(
		"files", "equipments", strconv.Itoa(equipmentID),
		"interventions", strconv.Itoa(interventionID)))
}

// Abs joins a stored relative path with the base directory.
func Abs(baseDir, relPath string) string {
	return filepath.Join(baseDir, filepath.FromSlash(relPath))
}

// CopyFile copies src to dst, creating dst's directory if needed. The copy is
// flushed to disk before returning, so a DB row committed to point at it
// afterwards never references a file lost in a crash. A partial copy is
// removed on failure.
func CopyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	_, err = io.Copy(out, in)
	if err == nil {
		err = out.Sync()
	}
	if cerr := out.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		os.Remove(dst)
	}
	return err
}
