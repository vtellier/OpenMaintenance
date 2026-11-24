package db

import (
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"

	"github.com/vtellier/OpenMaintenance/internal/filestore"
)

// fileTables are the tables whose file_path column references an attached
// file under files/ (see doc/file-storage.md).
var fileTables = []string{"equipment_files", "intervention_files"}

// FileCheck is the result of checking the attached files a database references
// against the files/ directory next to it.
type FileCheck struct {
	Referenced int      // attached files the database references
	Missing    []string // their relative paths (files/...) that are not on disk
}

// AllMissing reports whether the database references attached files and none
// of them is on disk: the files/ directory was left behind.
func (c FileCheck) AllMissing() bool {
	return c.Referenced > 0 && len(c.Missing) == c.Referenced
}

// CheckFiles lists the attached files conn references and reports which of
// them are missing from baseDir. A database whose file tables do not exist yet
// (one from before attachments) references nothing. It only reads.
func CheckFiles(conn *sql.DB, baseDir string) (FileCheck, error) {
	var check FileCheck
	for _, table := range fileTables {
		var n int
		if err := conn.QueryRow(
			`SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ?`, table,
		).Scan(&n); err != nil {
			return check, err
		}
		if n == 0 {
			continue
		}
		rows, err := conn.Query(`SELECT file_path FROM ` + table + ` ORDER BY file_path`)
		if err != nil {
			return check, err
		}
		for rows.Next() {
			var rel string
			if err := rows.Scan(&rel); err != nil {
				rows.Close()
				return check, err
			}
			check.Referenced++
			if _, err := os.Stat(filestore.Abs(baseDir, rel)); errors.Is(err, fs.ErrNotExist) {
				check.Missing = append(check.Missing, rel)
			}
		}
		if err := rows.Close(); err != nil {
			return check, err
		}
		if err := rows.Err(); err != nil {
			return check, err
		}
	}
	return check, nil
}

// checkFilesAtStartup runs CheckFiles on the database at dbPath before anything
// is written. It refuses to start when every referenced file is missing, and
// logs a warning when only some are. A database that does not exist yet is
// not checked.
func checkFilesAtStartup(dbPath string) error {
	if _, err := os.Stat(dbPath); errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	conn, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return err
	}
	defer conn.Close()

	baseDir, err := filestore.BaseDir(dbPath)
	if err != nil {
		return err
	}
	check, err := CheckFiles(conn, baseDir)
	if err != nil {
		return fmt.Errorf("checking attached files: %w", err)
	}
	filesDir := filestore.FilesDir(baseDir)
	if check.AllMissing() {
		what := fmt.Sprintf("%d attached files, but none of them are", check.Referenced)
		if check.Referenced == 1 {
			what = "1 attached file, but it is not"
		}
		return fmt.Errorf("the database %s references %s in %s: "+
			"move the files/ folder that belongs with this database to %s, then start again "+
			"(see doc/configuration.md, \"Moving your data\")",
			dbPath, what, filesDir, filesDir)
	}
	if len(check.Missing) > 0 {
		logMissingFiles(check, filesDir)
	}
	return nil
}

// missingFilesShown is how many missing paths a warning lists.
const missingFilesShown = 5

func logMissingFiles(check FileCheck, filesDir string) {
	shown := check.Missing
	more := ""
	if len(shown) > missingFilesShown {
		more = fmt.Sprintf(" (and %d more)", len(shown)-missingFilesShown)
		shown = shown[:missingFilesShown]
	}
	log.Printf("warning: %d of %d attached files referenced by the database are missing from %s: %v%s",
		len(check.Missing), check.Referenced, filesDir, shown, more)
}
