package db

import (
	"database/sql"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

const taskColumns = "id, equipment_id, name, description, kind, hours_interval, months_interval, current_expiry_date, created_at, updated_at"

func scanTask(s interface {
	Scan(...any) error
}, task *models.Task) error {
	var currentExpiryDate sql.NullString
	err := s.Scan(
		&task.ID,
		&task.EquipmentID,
		&task.Name,
		&task.Description,
		&task.Kind,
		&task.HoursInterval,
		&task.MonthsInterval,
		&currentExpiryDate,
		&task.CreatedAt,
		&task.UpdatedAt,
	)
	if err != nil {
		return err
	}
	if currentExpiryDate.Valid {
		task.CurrentExpiryDate = &currentExpiryDate.String
	}
	return nil
}

func CreateTask(db *sql.DB, task *models.Task) error {
	task.CreatedAt = time.Now()
	task.UpdatedAt = time.Now()
	if task.Kind == "" {
		task.Kind = models.KindInterval
	}

	result, err := db.Exec(
		"INSERT INTO tasks (equipment_id, name, description, kind, hours_interval, months_interval, current_expiry_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		task.EquipmentID,
		task.Name,
		task.Description,
		task.Kind,
		task.HoursInterval,
		task.MonthsInterval,
		task.CurrentExpiryDate,
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
	row := db.QueryRow("SELECT "+taskColumns+" FROM tasks WHERE id = ?", id)

	task := &models.Task{}
	if err := scanTask(row, task); err != nil {
		return nil, err
	}
	return task, nil
}

// UpdateTask saves a task's editable fields. The kind is fixed at creation
// and never written here.
func UpdateTask(db *sql.DB, task *models.Task) error {
	task.UpdatedAt = time.Now()

	_, err := db.Exec(
		"UPDATE tasks SET equipment_id = ?, name = ?, description = ?, hours_interval = ?, months_interval = ?, current_expiry_date = ?, updated_at = ? WHERE id = ?",
		task.EquipmentID,
		task.Name,
		task.Description,
		task.HoursInterval,
		task.MonthsInterval,
		task.CurrentExpiryDate,
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
	return listTasks(db, "SELECT "+taskColumns+" FROM tasks")
}

func ListTasksByEquipment(db *sql.DB, equipmentID int) ([]models.Task, error) {
	return listTasks(db, "SELECT "+taskColumns+" FROM tasks WHERE equipment_id = ?", equipmentID)
}

func listTasks(db *sql.DB, query string, args ...any) ([]models.Task, error) {
	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]models.Task, 0)
	for rows.Next() {
		task := models.Task{}
		if err := scanTask(rows, &task); err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
}
