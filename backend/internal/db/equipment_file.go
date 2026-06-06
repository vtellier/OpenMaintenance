package db

import (
	"database/sql"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

func CreateEquipmentFile(db *sql.DB, f *models.EquipmentFile) error {
	if f.UploadedAt.IsZero() {
		f.UploadedAt = time.Now()
	}
	_, err := db.Exec(
		`INSERT INTO equipment_files (equipment_id, file_path, original_name, uploaded_at)
		 VALUES (?, ?, ?, ?)`,
		f.EquipmentID, f.FilePath, f.OriginalName, f.UploadedAt,
	)
	return err
}

func ListEquipmentFiles(db *sql.DB, equipmentID int) ([]models.EquipmentFile, error) {
	rows, err := db.Query(
		`SELECT equipment_id, file_path, original_name, uploaded_at
		 FROM equipment_files WHERE equipment_id = ? ORDER BY uploaded_at`,
		equipmentID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	files := make([]models.EquipmentFile, 0)
	for rows.Next() {
		var f models.EquipmentFile
		if err := rows.Scan(&f.EquipmentID, &f.FilePath, &f.OriginalName, &f.UploadedAt); err != nil {
			return nil, err
		}
		files = append(files, f)
	}
	return files, rows.Err()
}

// GetEquipmentFileByPath looks up a single attached document by its full
// relative file_path.
func GetEquipmentFileByPath(db *sql.DB, equipmentID int, filePath string) (*models.EquipmentFile, error) {
	row := db.QueryRow(
		`SELECT equipment_id, file_path, original_name, uploaded_at
		 FROM equipment_files WHERE equipment_id = ? AND file_path = ?`,
		equipmentID, filePath,
	)
	var f models.EquipmentFile
	if err := row.Scan(&f.EquipmentID, &f.FilePath, &f.OriginalName, &f.UploadedAt); err != nil {
		return nil, err
	}
	return &f, nil
}

func DeleteEquipmentFile(db *sql.DB, equipmentID int, filePath string) error {
	_, err := db.Exec(
		`DELETE FROM equipment_files WHERE equipment_id = ? AND file_path = ?`,
		equipmentID, filePath,
	)
	return err
}
