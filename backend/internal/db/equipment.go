package db

import (
	"database/sql"
	"github.com/vtellier/OpenMaintenance/internal/models"
	"time"
)

func CreateEquipment(db *sql.DB, equipment *models.Equipment) error {
	equipment.CreatedAt = time.Now()
	equipment.UpdatedAt = time.Now()

	result, err := db.Exec(
		`INSERT INTO equipments (name, description, commissioned_at, tracks_hours, hours, hours_updated_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		equipment.Name,
		equipment.Description,
		equipment.CommissionedAt,
		equipment.TracksHours,
		equipment.Hours,
		equipment.HoursUpdatedAt,
		equipment.CreatedAt,
		equipment.UpdatedAt,
	)
	if err != nil {
		return err
	}

	id, _ := result.LastInsertId()
	equipment.ID = int(id)
	return nil
}

func GetEquipment(db *sql.DB, id int) (*models.Equipment, error) {
	row := db.QueryRow(
		`SELECT id, name, description, commissioned_at, tracks_hours, hours, hours_updated_at, created_at, updated_at
		 FROM equipments WHERE id = ?`, id,
	)
	equipment := &models.Equipment{}
	var commissionedAt sql.NullString
	var hours sql.NullFloat64
	var hoursUpdatedAt sql.NullTime
	err := row.Scan(
		&equipment.ID,
		&equipment.Name,
		&equipment.Description,
		&commissionedAt,
		&equipment.TracksHours,
		&hours,
		&hoursUpdatedAt,
		&equipment.CreatedAt,
		&equipment.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if commissionedAt.Valid {
		equipment.CommissionedAt = &commissionedAt.String
	}
	if hours.Valid {
		equipment.Hours = &hours.Float64
	}
	if hoursUpdatedAt.Valid {
		equipment.HoursUpdatedAt = &hoursUpdatedAt.Time
	}
	return equipment, nil
}

func UpdateEquipment(db *sql.DB, equipment *models.Equipment) error {
	equipment.UpdatedAt = time.Now()

	_, err := db.Exec(
		`UPDATE equipments SET name = ?, description = ?, commissioned_at = ?, tracks_hours = ?, hours = ?, hours_updated_at = ?, updated_at = ?
		 WHERE id = ?`,
		equipment.Name,
		equipment.Description,
		equipment.CommissionedAt,
		equipment.TracksHours,
		equipment.Hours,
		equipment.HoursUpdatedAt,
		equipment.UpdatedAt,
		equipment.ID,
	)
	return err
}

func DeleteEquipment(db *sql.DB, id int) error {
	DeleteTasksByEquipment(db, id)
	db.Exec("DELETE FROM equipment_files WHERE equipment_id = ?", id)
	_, err := db.Exec("DELETE FROM equipments WHERE id = ?", id)
	return err
}

func ListEquipments(db *sql.DB) ([]models.Equipment, error) {
	rows, err := db.Query(
		`SELECT id, name, description, commissioned_at, tracks_hours, hours, hours_updated_at, created_at, updated_at
		 FROM equipments`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	equipments := make([]models.Equipment, 0)
	for rows.Next() {
		equipment := models.Equipment{}
		var commissionedAt sql.NullString
		var hours sql.NullFloat64
		var hoursUpdatedAt sql.NullTime
		err := rows.Scan(
			&equipment.ID,
			&equipment.Name,
			&equipment.Description,
			&commissionedAt,
			&equipment.TracksHours,
			&hours,
			&hoursUpdatedAt,
			&equipment.CreatedAt,
			&equipment.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if commissionedAt.Valid {
			equipment.CommissionedAt = &commissionedAt.String
		}
		if hours.Valid {
			equipment.Hours = &hours.Float64
		}
		if hoursUpdatedAt.Valid {
			equipment.HoursUpdatedAt = &hoursUpdatedAt.Time
		}
		equipments = append(equipments, equipment)
	}

	return equipments, nil
}
