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
		"INSERT INTO equipments (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)",
		equipment.Name,
		equipment.Description,
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
	row := db.QueryRow("SELECT id, name, description, created_at, updated_at FROM equipments WHERE id = ?", id)

	equipment := &models.Equipment{}
	err := row.Scan(
		&equipment.ID,
		&equipment.Name,
		&equipment.Description,
		&equipment.CreatedAt,
		&equipment.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return equipment, nil
}

func UpdateEquipment(db *sql.DB, equipment *models.Equipment) error {
	equipment.UpdatedAt = time.Now()

	_, err := db.Exec(
		"UPDATE equipments SET name = ?, description = ?, updated_at = ? WHERE id = ?",
		equipment.Name,
		equipment.Description,
		equipment.UpdatedAt,
		equipment.ID,
	)
	return err
}

func DeleteEquipment(db *sql.DB, id int) error {
	_, err := db.Exec("DELETE FROM equipments WHERE id = ?", id)
	return err
}

func ListEquipments(db *sql.DB) ([]models.Equipment, error) {
	rows, err := db.Query("SELECT id, name, description, created_at, updated_at FROM equipments")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var equipments []models.Equipment
	for rows.Next() {
		equipment := models.Equipment{}
		err := rows.Scan(
			&equipment.ID,
			&equipment.Name,
			&equipment.Description,
			&equipment.CreatedAt,
			&equipment.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		equipments = append(equipments, equipment)
	}

	return equipments, nil
}