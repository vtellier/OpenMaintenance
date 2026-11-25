package db

import (
	"database/sql"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/attachments"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

const interventionColumns = "id, task_id, equipment_id, exceptional_label, date, location, performed_by, comments, hours_at, expiry_date, created_at, updated_at"

func scanIntervention(s interface {
	Scan(...any) error
}, intervention *models.Intervention) error {
	var taskID sql.NullInt64
	var equipmentID sql.NullInt64
	var exceptionalLabel sql.NullString
	var hoursAt sql.NullFloat64
	var expiryDate sql.NullString

	err := s.Scan(
		&intervention.ID,
		&taskID,
		&equipmentID,
		&exceptionalLabel,
		&intervention.Date,
		&intervention.Location,
		&intervention.PerformedBy,
		&intervention.Comments,
		&hoursAt,
		&expiryDate,
		&intervention.CreatedAt,
		&intervention.UpdatedAt,
	)
	if err != nil {
		return err
	}
	if taskID.Valid {
		v := int(taskID.Int64)
		intervention.TaskID = &v
	}
	if equipmentID.Valid {
		v := int(equipmentID.Int64)
		intervention.EquipmentID = &v
	}
	if exceptionalLabel.Valid {
		intervention.ExceptionalLabel = &exceptionalLabel.String
	}
	if hoursAt.Valid {
		intervention.HoursAt = &hoursAt.Float64
	}
	if expiryDate.Valid {
		intervention.ExpiryDate = &expiryDate.String
	}
	return nil
}

// CreateIntervention saves a new intervention and, in the same transaction,
// clears the current expiry date of the expiry task it replaces a part on
// (see clearReplacedExpiryDate).
func CreateIntervention(db *sql.DB, intervention *models.Intervention) error {
	return InTx(db, func(tx *sql.Tx) error { return CreateInterventionTx(tx, intervention) })
}

// CreateInterventionTx is CreateIntervention within the caller's transaction.
// It sets the intervention's id, which only holds once the caller commits.
func CreateInterventionTx(tx *sql.Tx, intervention *models.Intervention) error {
	intervention.CreatedAt = time.Now()
	intervention.UpdatedAt = time.Now()

	result, err := tx.Exec(
		"INSERT INTO interventions (task_id, equipment_id, exceptional_label, date, location, performed_by, comments, hours_at, expiry_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		intervention.TaskID,
		intervention.EquipmentID,
		intervention.ExceptionalLabel,
		intervention.Date,
		intervention.Location,
		intervention.PerformedBy,
		intervention.Comments,
		intervention.HoursAt,
		intervention.ExpiryDate,
		intervention.CreatedAt,
		intervention.UpdatedAt,
	)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	intervention.ID = int(id)
	return clearReplacedExpiryDate(tx, intervention)
}

func GetIntervention(db *sql.DB, id int) (*models.Intervention, error) {
	row := db.QueryRow(
		"SELECT "+interventionColumns+" FROM interventions WHERE id = ?", id,
	)
	intervention := &models.Intervention{}
	if err := scanIntervention(row, intervention); err != nil {
		return nil, err
	}
	return intervention, nil
}

// UpdateInterventionTx saves an edited intervention within the caller's
// transaction, and clears the current expiry date of the expiry task it now
// replaces a part on (see clearReplacedExpiryDate). It has no variant that
// commits on its own: an edit is saved with the hour-meter reading it raises.
func UpdateInterventionTx(tx *sql.Tx, intervention *models.Intervention) error {
	return updateIntervention(tx, intervention)
}

// execer is satisfied by both *sql.DB and *sql.Tx, so a write can run on its
// own or as part of a transaction.
type execer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

func updateIntervention(db execer, intervention *models.Intervention) error {
	intervention.UpdatedAt = time.Now()

	_, err := db.Exec(
		"UPDATE interventions SET task_id = ?, equipment_id = ?, exceptional_label = ?, date = ?, location = ?, performed_by = ?, comments = ?, hours_at = ?, expiry_date = ?, updated_at = ? WHERE id = ?",
		intervention.TaskID,
		intervention.EquipmentID,
		intervention.ExceptionalLabel,
		intervention.Date,
		intervention.Location,
		intervention.PerformedBy,
		intervention.Comments,
		intervention.HoursAt,
		intervention.ExpiryDate,
		intervention.UpdatedAt,
		intervention.ID,
	)
	if err != nil {
		return err
	}
	return clearReplacedExpiryDate(db, intervention)
}

// clearReplacedExpiryDate clears the current expiry date of the task an
// intervention fits a part on: only interventions on an expiry task carry an
// expiry date, and that task's current expiry date belonged to the part just
// replaced, so it must not come back once the interventions are deleted
// (doc/data-model.md, Task rules).
func clearReplacedExpiryDate(db execer, intervention *models.Intervention) error {
	if intervention.TaskID == nil || intervention.ExpiryDate == nil {
		return nil
	}
	_, err := db.Exec(
		"UPDATE tasks SET current_expiry_date = NULL WHERE id = ? AND kind = ?",
		*intervention.TaskID, models.KindExpiry,
	)
	return err
}

// DeleteIntervention deletes an intervention and its photos, their files last.
func DeleteIntervention(db *sql.DB, files *attachments.Store, id int) error {
	photos, err := photosOf(db, "id = ?", id)
	if err != nil {
		return err
	}
	removeFiles, err := files.DeleteAll(db, photos...)
	if err != nil {
		return err
	}
	if _, err := db.Exec("DELETE FROM interventions WHERE id = ?", id); err != nil {
		return err
	}
	removeFiles()
	return nil
}

// photosOf names the photos of each intervention matching where. An
// intervention without an equipment predates photos and has none, so it is
// left out.
func photosOf(db *sql.DB, where string, args ...any) ([]attachments.Owner, error) {
	rows, err := db.Query("SELECT id, equipment_id FROM interventions WHERE "+where, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var photos []attachments.Owner
	for rows.Next() {
		var id int
		var equipmentID sql.NullInt64
		if err := rows.Scan(&id, &equipmentID); err != nil {
			return nil, err
		}
		if equipmentID.Valid {
			photos = append(photos, attachments.InterventionPhotos(int(equipmentID.Int64), id))
		}
	}
	return photos, rows.Err()
}

// interventionIDs returns the ids of the interventions of an equipment.
func interventionIDs(db *sql.DB, equipmentID int) ([]int, error) {
	rows, err := db.Query("SELECT id FROM interventions WHERE equipment_id = ?", equipmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func ListInterventions(db *sql.DB) ([]models.Intervention, error) {
	rows, err := db.Query("SELECT " + interventionColumns + " FROM interventions")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	interventions := make([]models.Intervention, 0)
	for rows.Next() {
		intervention := models.Intervention{}
		if err := scanIntervention(rows, &intervention); err != nil {
			return nil, err
		}
		interventions = append(interventions, intervention)
	}
	return interventions, nil
}

// DeleteInterventionsByTask deletes the interventions of a task and their
// photos, their files last.
func DeleteInterventionsByTask(db *sql.DB, files *attachments.Store, taskID int) error {
	photos, err := photosOf(db, "task_id = ?", taskID)
	if err != nil {
		return err
	}
	removeFiles, err := files.DeleteAll(db, photos...)
	if err != nil {
		return err
	}
	if _, err := db.Exec("DELETE FROM interventions WHERE task_id = ?", taskID); err != nil {
		return err
	}
	removeFiles()
	return nil
}

func ListInterventionsByTask(db *sql.DB, taskID int) ([]models.Intervention, error) {
	rows, err := db.Query(
		"SELECT "+interventionColumns+" FROM interventions WHERE task_id = ?", taskID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	interventions := make([]models.Intervention, 0)
	for rows.Next() {
		intervention := models.Intervention{}
		if err := scanIntervention(rows, &intervention); err != nil {
			return nil, err
		}
		interventions = append(interventions, intervention)
	}
	return interventions, nil
}
