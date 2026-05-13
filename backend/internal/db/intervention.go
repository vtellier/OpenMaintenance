package db

import (
	"database/sql"
	"github.com/vtellier/OpenMaintenance/internal/models"
	"time"
)

func CreateIntervention(db *sql.DB, intervention *models.Intervention) error {
	intervention.CreatedAt = time.Now()
	intervention.UpdatedAt = time.Now()

	result, err := db.Exec(
		"INSERT INTO interventions (task_id, date, location, comments, hours_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		intervention.TaskID,
		intervention.Date,
		intervention.Location,
		intervention.Comments,
		intervention.HoursAt,
		intervention.CreatedAt,
		intervention.UpdatedAt,
	)
	if err != nil {
		return err
	}

	id, _ := result.LastInsertId()
	intervention.ID = int(id)
	return nil
}

func GetIntervention(db *sql.DB, id int) (*models.Intervention, error) {
	row := db.QueryRow(
		"SELECT id, task_id, date, location, comments, hours_at, created_at, updated_at FROM interventions WHERE id = ?", id,
	)

	intervention := &models.Intervention{}
	var hoursAt sql.NullFloat64
	err := row.Scan(
		&intervention.ID,
		&intervention.TaskID,
		&intervention.Date,
		&intervention.Location,
		&intervention.Comments,
		&hoursAt,
		&intervention.CreatedAt,
		&intervention.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if hoursAt.Valid {
		intervention.HoursAt = &hoursAt.Float64
	}

	return intervention, nil
}

func UpdateIntervention(db *sql.DB, intervention *models.Intervention) error {
	intervention.UpdatedAt = time.Now()

	_, err := db.Exec(
		"UPDATE interventions SET task_id = ?, date = ?, location = ?, comments = ?, hours_at = ?, updated_at = ? WHERE id = ?",
		intervention.TaskID,
		intervention.Date,
		intervention.Location,
		intervention.Comments,
		intervention.HoursAt,
		intervention.UpdatedAt,
		intervention.ID,
	)
	return err
}

func DeleteIntervention(db *sql.DB, id int) error {
	_, err := db.Exec("DELETE FROM interventions WHERE id = ?", id)
	return err
}

func ListInterventions(db *sql.DB) ([]models.Intervention, error) {
	rows, err := db.Query(
		"SELECT id, task_id, date, location, comments, hours_at, created_at, updated_at FROM interventions",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var interventions []models.Intervention
	for rows.Next() {
		intervention := models.Intervention{}
		var hoursAt sql.NullFloat64
		err := rows.Scan(
			&intervention.ID,
			&intervention.TaskID,
			&intervention.Date,
			&intervention.Location,
			&intervention.Comments,
			&hoursAt,
			&intervention.CreatedAt,
			&intervention.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if hoursAt.Valid {
			intervention.HoursAt = &hoursAt.Float64
		}
		interventions = append(interventions, intervention)
	}

	return interventions, nil
}

func GetLastInterventionByTask(db *sql.DB, taskID int) (*models.Intervention, error) {
	row := db.QueryRow(
		"SELECT id, task_id, date, location, comments, hours_at, created_at, updated_at FROM interventions WHERE task_id = ? ORDER BY date DESC LIMIT 1", taskID,
	)

	intervention := &models.Intervention{}
	var hoursAt sql.NullFloat64
	err := row.Scan(
		&intervention.ID,
		&intervention.TaskID,
		&intervention.Date,
		&intervention.Location,
		&intervention.Comments,
		&hoursAt,
		&intervention.CreatedAt,
		&intervention.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if hoursAt.Valid {
		intervention.HoursAt = &hoursAt.Float64
	}

	return intervention, nil
}

func DeleteInterventionsByTask(db *sql.DB, taskID int) error {
	_, err := db.Exec("DELETE FROM interventions WHERE task_id = ?", taskID)
	return err
}

func ListInterventionsByTask(db *sql.DB, taskID int) ([]models.Intervention, error) {
	rows, err := db.Query(
		"SELECT id, task_id, date, location, comments, hours_at, created_at, updated_at FROM interventions WHERE task_id = ?", taskID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var interventions []models.Intervention
	for rows.Next() {
		intervention := models.Intervention{}
		var hoursAt sql.NullFloat64
		err := rows.Scan(
			&intervention.ID,
			&intervention.TaskID,
			&intervention.Date,
			&intervention.Location,
			&intervention.Comments,
			&hoursAt,
			&intervention.CreatedAt,
			&intervention.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if hoursAt.Valid {
			intervention.HoursAt = &hoursAt.Float64
		}
		interventions = append(interventions, intervention)
	}

	return interventions, nil
}