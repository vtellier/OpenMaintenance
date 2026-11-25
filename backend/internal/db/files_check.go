package db

import (
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"

	"github.com/vtellier/OpenMaintenance/internal/attachments"
	"github.com/vtellier/OpenMaintenance/internal/filestore"
)

// checkFilesAtStartup checks the attached files of the database at dbPath before anything
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
	check, err := attachments.New(conn, baseDir).CheckFiles()
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

func logMissingFiles(check attachments.FileCheck, filesDir string) {
	shown := check.Missing
	more := ""
	if len(shown) > missingFilesShown {
		more = fmt.Sprintf(" (and %d more)", len(shown)-missingFilesShown)
		shown = shown[:missingFilesShown]
	}
	log.Printf("warning: %d of %d attached files referenced by the database are missing from %s: %v%s",
		len(check.Missing), check.Referenced, filesDir, shown, more)
}
