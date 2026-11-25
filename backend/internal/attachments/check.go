package attachments

import (
	"errors"
	"io/fs"
	"os"
)

// kinds are every kind of attachment, in the order their files are checked.
var kinds = []*Kind{Document, Photo}

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

// CheckFiles lists the attached files the database references and reports
// which of them are missing from disk. A database whose attachment tables do
// not exist yet (one from before attachments) references nothing. It only
// reads, so it can run at startup before anything is written, and on a backup.
func (s *Store) CheckFiles() (FileCheck, error) {
	var check FileCheck
	for _, k := range kinds {
		var n int
		if err := s.db.QueryRow(
			`SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ?`, k.table,
		).Scan(&n); err != nil {
			return check, err
		}
		if n == 0 {
			continue
		}
		rows, err := s.db.Query(`SELECT file_path FROM ` + k.table + ` ORDER BY file_path`)
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
			if _, err := os.Stat(s.abs(rel)); errors.Is(err, fs.ErrNotExist) {
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
