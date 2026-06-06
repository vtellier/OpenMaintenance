package models

import "time"

// InterventionFile is a photo attached to an intervention. It records only a
// reference to the file on disk — the bytes live under the files/ directory.
type InterventionFile struct {
	InterventionID int       `db:"intervention_id" json:"intervention_id"`
	FilePath       string    `db:"file_path" json:"file_path"`
	OriginalName   string    `db:"original_name" json:"original_name"`
	UploadedAt     time.Time `db:"uploaded_at" json:"uploaded_at"`
}
