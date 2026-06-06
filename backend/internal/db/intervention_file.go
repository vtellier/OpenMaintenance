package db

import (
	"database/sql"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

func CreateInterventionFile(db *sql.DB, f *models.InterventionFile) error {
	if f.UploadedAt.IsZero() {
		f.UploadedAt = time.Now()
	}
	_, err := db.Exec(
		`INSERT INTO intervention_files (intervention_id, file_path, original_name, uploaded_at)
		 VALUES (?, ?, ?, ?)`,
		f.InterventionID, f.FilePath, f.OriginalName, f.UploadedAt,
	)
	return err
}

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

// GetInterventionFileByPath looks up a single attached photo by its full
// relative file_path.
func GetInterventionFileByPath(db *sql.DB, interventionID int, filePath string) (*models.InterventionFile, error) {
	row := db.QueryRow(
		`SELECT intervention_id, file_path, original_name, uploaded_at
		 FROM intervention_files WHERE intervention_id = ? AND file_path = ?`,
		interventionID, filePath,
	)
	var f models.InterventionFile
	if err := row.Scan(&f.InterventionID, &f.FilePath, &f.OriginalName, &f.UploadedAt); err != nil {
		return nil, err
	}
	return &f, nil
}

// CountInterventionFiles returns the number of photos attached to a single
// intervention.
func CountInterventionFiles(db *sql.DB, interventionID int) (int, error) {
	var n int
	err := db.QueryRow(
		`SELECT COUNT(*) FROM intervention_files WHERE intervention_id = ?`,
		interventionID,
	).Scan(&n)
	return n, err
}

// CountInterventionFilesByIntervention returns photo counts keyed by
// intervention id, for cheaply enriching a list of interventions in one query.
func CountInterventionFilesByIntervention(db *sql.DB) (map[int]int, error) {
	rows, err := db.Query(
		`SELECT intervention_id, COUNT(*) FROM intervention_files GROUP BY intervention_id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[int]int)
	for rows.Next() {
		var id, n int
		if err := rows.Scan(&id, &n); err != nil {
			return nil, err
		}
		counts[id] = n
	}
	return counts, rows.Err()
}

func DeleteInterventionFile(db *sql.DB, interventionID int, filePath string) error {
	_, err := db.Exec(
		`DELETE FROM intervention_files WHERE intervention_id = ? AND file_path = ?`,
		interventionID, filePath,
	)
	return err
}
