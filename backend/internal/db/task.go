package db

import (
	"database/sql"
	"github.com/vtellier/OpenMaintenance/internal/models"
	"time"
)

func CreateTask(db *sql.DB, task *models.Task) error {
	task.CreatedAt = time.Now()
	task.UpdatedAt = time.Now()

	result, err := db.Exec(
		"INSERT INTO tasks (equipment_id, name, description, hours_interval, months_interval, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		task.EquipmentID,
		task.Name,
		task.Description,
		task.HoursInterval,
		task.MonthsInterval,
		task.CreatedAt,
		task.UpdatedAt,
	)
	if err != nil {
		return err
	}

	id, _ := result.LastInsertId()
	task.ID = int(id)
	return nil
}

func GetTask(db *sql.DB, id int) (*models.Task, error) {
	row := db.QueryRow("SELECT id, equipment_id, name, description, hours_interval, months_interval, created_at, updated_at FROM tasks WHERE id = ?", id)

	task := &models.Task{}
	err := row.Scan(
		&task.ID,
		&task.EquipmentID,
		&task.Name,
		&task.Description,
		&task.HoursInterval,
		&task.MonthsInterval,
		&task.CreatedAt,
		&task.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return task, nil
}

func UpdateTask(db *sql.DB, task *models.Task) error {
	task.UpdatedAt = time.Now()

	_, err := db.Exec(
		"UPDATE tasks SET equipment_id = ?, name = ?, description = ?, hours_interval = ?, months_interval = ?, updated_at = ? WHERE id = ?",
		task.EquipmentID,
		task.Name,
		task.Description,
		task.HoursInterval,
		task.MonthsInterval,
		task.UpdatedAt,
		task.ID,
	)
	return err
}

func DeleteTask(db *sql.DB, id int) error {
	DeleteInterventionsByTask(db, id)
	_, err := db.Exec("DELETE FROM tasks WHERE id = ?", id)
	return err
}

func DeleteTasksByEquipment(db *sql.DB, equipmentID int) error {
	tasks, err := ListTasksByEquipment(db, equipmentID)
	if err != nil {
		return err
	}
	for _, t := range tasks {
		if err := DeleteTask(db, t.ID); err != nil {
			return err
		}
	}
	return nil
}

func ListTasks(db *sql.DB) ([]models.Task, error) {
	rows, err := db.Query("SELECT id, equipment_id, name, description, hours_interval, months_interval, created_at, updated_at FROM tasks")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]models.Task, 0)
	for rows.Next() {
		task := models.Task{}
		err := rows.Scan(
			&task.ID,
			&task.EquipmentID,
			&task.Name,
			&task.Description,
			&task.HoursInterval,
			&task.MonthsInterval,
			&task.CreatedAt,
			&task.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}

	return tasks, nil
}

func ListTasksByEquipment(db *sql.DB, equipmentID int) ([]models.Task, error) {
	rows, err := db.Query("SELECT id, equipment_id, name, description, hours_interval, months_interval, created_at, updated_at FROM tasks WHERE equipment_id = ?", equipmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]models.Task, 0)
	for rows.Next() {
		task := models.Task{}
		err := rows.Scan(
			&task.ID,
			&task.EquipmentID,
			&task.Name,
			&task.Description,
			&task.HoursInterval,
			&task.MonthsInterval,
			&task.CreatedAt,
			&task.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}

	return tasks, nil
}