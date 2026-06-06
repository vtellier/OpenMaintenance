package db

import (
	"database/sql"
	"github.com/vtellier/OpenMaintenance/internal/models"
	"time"
)

// DefaultEquipmentIcon is the emoji shown when an equipment has neither a
// picture nor a custom icon.
const DefaultEquipmentIcon = "🔧"

func CreateEquipment(db *sql.DB, equipment *models.Equipment) error {
	equipment.CreatedAt = time.Now()
	equipment.UpdatedAt = time.Now()
	if equipment.Icon == "" {
		equipment.Icon = DefaultEquipmentIcon
	}

	result, err := db.Exec(
		`INSERT INTO equipments (name, description, commissioned_at, icon, tracks_hours, hours, hours_updated_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		equipment.Name,
		equipment.Description,
		equipment.CommissionedAt,
		equipment.Icon,
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
		`SELECT id, name, description, commissioned_at, picture, icon, tracks_hours, hours, hours_updated_at, created_at, updated_at
		 FROM equipments WHERE id = ?`, id,
	)
	equipment := &models.Equipment{}
	var commissionedAt sql.NullString
	var picture sql.NullString
	var icon sql.NullString
	var hours sql.NullFloat64
	var hoursUpdatedAt sql.NullTime
	err := row.Scan(
		&equipment.ID,
		&equipment.Name,
		&equipment.Description,
		&commissionedAt,
		&picture,
		&icon,
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
	if picture.Valid && picture.String != "" {
		equipment.Picture = &picture.String
	}
	equipment.Icon = iconOrDefault(icon)
	if hours.Valid {
		equipment.Hours = &hours.Float64
	}
	if hoursUpdatedAt.Valid {
		equipment.HoursUpdatedAt = &hoursUpdatedAt.Time
	}
	return equipment, nil
}

// iconOrDefault returns the stored icon, falling back to the default emoji when
// it is NULL or empty (e.g. rows created before the icon column existed).
func iconOrDefault(icon sql.NullString) string {
	if icon.Valid && icon.String != "" {
		return icon.String
	}
	return DefaultEquipmentIcon
}

// UpdateEquipment updates editable equipment metadata. It deliberately does
// not touch the picture column — the profile picture is managed through the
// dedicated picture endpoints, not the generic update payload.
func UpdateEquipment(db *sql.DB, equipment *models.Equipment) error {
	equipment.UpdatedAt = time.Now()
	if equipment.Icon == "" {
		equipment.Icon = DefaultEquipmentIcon
	}

	_, err := db.Exec(
		`UPDATE equipments SET name = ?, description = ?, commissioned_at = ?, icon = ?, tracks_hours = ?, hours = ?, hours_updated_at = ?, updated_at = ?
		 WHERE id = ?`,
		equipment.Name,
		equipment.Description,
		equipment.CommissionedAt,
		equipment.Icon,
		equipment.TracksHours,
		equipment.Hours,
		equipment.HoursUpdatedAt,
		equipment.UpdatedAt,
		equipment.ID,
	)
	return err
}

// UpdateEquipmentPicture sets (or clears, when picture is nil) the relative
// path to an equipment's profile picture.
func UpdateEquipmentPicture(db *sql.DB, id int, picture *string) error {
	_, err := db.Exec(
		`UPDATE equipments SET picture = ?, updated_at = ? WHERE id = ?`,
		picture, time.Now(), id,
	)
	return err
}

func DeleteEquipment(db *sql.DB, id int) error {
	// Remove photos of any intervention belonging to this equipment (including
	// exceptional interventions, which are not tied to a task) before the
	// interventions themselves are gone.
	db.Exec(
		`DELETE FROM intervention_files
		 WHERE intervention_id IN (SELECT id FROM interventions WHERE equipment_id = ?)`,
		id,
	)
	DeleteTasksByEquipment(db, id)
	db.Exec("DELETE FROM interventions WHERE equipment_id = ?", id)
	db.Exec("DELETE FROM equipment_files WHERE equipment_id = ?", id)
	_, err := db.Exec("DELETE FROM equipments WHERE id = ?", id)
	return err
}

func ListEquipments(db *sql.DB) ([]models.Equipment, error) {
	rows, err := db.Query(
		`SELECT id, name, description, commissioned_at, picture, icon, tracks_hours, hours, hours_updated_at, created_at, updated_at
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
		var picture sql.NullString
		var icon sql.NullString
		var hours sql.NullFloat64
		var hoursUpdatedAt sql.NullTime
		err := rows.Scan(
			&equipment.ID,
			&equipment.Name,
			&equipment.Description,
			&commissionedAt,
			&picture,
			&icon,
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
		if picture.Valid && picture.String != "" {
			equipment.Picture = &picture.String
		}
		equipment.Icon = iconOrDefault(icon)
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
