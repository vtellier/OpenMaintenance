// Package filestore resolves on-disk locations for attached files and keeps
// the files/ directory tree in sync with the database. Files live in a
// files/ directory next to the SQLite database; the database stores only
// relative paths (e.g. files/equipments/12/files/abc123.pdf).
package filestore

import (
	"os"
	"path/filepath"
	"strconv"
)

// MaxDocumentSize is the largest equipment document accepted, in bytes (25 MB).
const MaxDocumentSize = 25 << 20

// BaseDir returns the directory that contains the files/ tree, derived from
// the database path. Relative database paths are resolved against the
// executable's directory, matching db.InitDB.
func BaseDir(dbPath string) (string, error) {
	if !filepath.IsAbs(dbPath) {
		exe, err := os.Executable()
		if err != nil {
			return "", err
		}
		dbPath = filepath.Join(filepath.Dir(exe), dbPath)
	}
	return filepath.Dir(dbPath), nil
}

// EnsureFilesDir creates the files/ directory under baseDir if it is missing.
func EnsureFilesDir(baseDir string) error {
	return os.MkdirAll(filepath.Join(baseDir, "files"), 0755)
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

// Abs joins a stored relative path with the base directory.
func Abs(baseDir, relPath string) string {
	return filepath.Join(baseDir, filepath.FromSlash(relPath))
}
