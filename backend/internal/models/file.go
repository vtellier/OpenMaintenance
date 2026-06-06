package models

import "time"

// EquipmentFile is a document attached to an equipment. It records only a
// reference to the file on disk — the bytes live under the files/ directory.
type EquipmentFile struct {
	EquipmentID  int       `db:"equipment_id" json:"equipment_id"`
	FilePath     string    `db:"file_path" json:"file_path"`
	OriginalName string    `db:"original_name" json:"original_name"`
	UploadedAt   time.Time `db:"uploaded_at" json:"uploaded_at"`
}
