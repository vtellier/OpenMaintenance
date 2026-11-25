package db

import (
	"database/sql"
	"errors"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

func ListInterventionFiles(db *sql.DB, interventionID int) ([]models.InterventionFile, error) {
	rows, err := db.Query(
		`SELECT intervention_id, file_path, original_name, uploaded_at
		 FROM intervention_files WHERE intervention_id = ? ORDER BY uploaded_at`,
		interventionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	files := make([]models.InterventionFile, 0)
	for rows.Next() {
		var f models.InterventionFile
		if err := rows.Scan(&f.InterventionID, &f.FilePath, &f.OriginalName, &f.UploadedAt); err != nil {
			return nil, err
		}
		files = append(files, f)
	}
	return files, rows.Err()
}

// execer is satisfied by both *sql.DB and *sql.Tx, so a write can run on its
// own or as part of a transaction.
type execer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

// UpdateInterventionWithFilePaths saves an intervention and rewrites the
// file_path of its photos (old path -> new path) in one transaction. Used when
// an intervention moves to another equipment and its photos move with it, so
// the intervention and its photo rows never disagree on the equipment.
//
// Every old path must still match a row; if one does not (the photos changed
// concurrently, e.g. another move or a delete), nothing is saved and
// ErrInterventionFilesChanged is returned.
func UpdateInterventionWithFilePaths(db *sql.DB, intervention *models.Intervention, newPaths map[string]string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() // no-op once committed

	if err := updateIntervention(tx, intervention); err != nil {
		return err
	}
	for oldPath, newPath := range newPaths {
		res, err := tx.Exec(
			`UPDATE intervention_files SET file_path = ? WHERE intervention_id = ? AND file_path = ?`,
			newPath, intervention.ID, oldPath,
		)
		if err != nil {
			return err
		}
		if n, err := res.RowsAffected(); err != nil {
			return err
		} else if n != 1 {
			return ErrInterventionFilesChanged
		}
	}
	return tx.Commit()
}

// ErrInterventionFilesChanged reports that an intervention's photo rows no
// longer match what a move read before copying the files.
var ErrInterventionFilesChanged = errors.New("the intervention's photos changed during the move; try again")
