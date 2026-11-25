package db

import (
	"database/sql"

	"github.com/vtellier/OpenMaintenance/internal/attachments"
)

// Deleting an owner (equipment, task, intervention) deletes it, everything it
// owns and their attachment rows in one transaction: on any failure nothing
// is deleted. The attachments' directories are removed only once that
// transaction is committed (doc/file-storage.md, "Entity deletion cascade").

// DeleteEquipment deletes an equipment, its tasks, all its interventions
// (exceptional ones included), its documents and their photos.
func DeleteEquipment(db *sql.DB, files *attachments.Store, id int) error {
	return deleteInTx(db, func(tx *sql.Tx) (func(), error) {
		ids, err := queryIDs(tx, "SELECT id FROM interventions WHERE equipment_id = ?", id)
		if err != nil {
			return nil, err
		}
		removeFiles, err := files.DeleteEquipment(tx, id, ids)
		if err != nil {
			return nil, err
		}
		removals := []func(){removeFiles}

		taskIDs, err := queryIDs(tx, "SELECT id FROM tasks WHERE equipment_id = ?", id)
		if err != nil {
			return nil, err
		}
		for _, taskID := range taskIDs {
			removeFiles, err := deleteTask(tx, files, taskID)
			if err != nil {
				return nil, err
			}
			removals = append(removals, removeFiles)
		}
		if _, err := tx.Exec("DELETE FROM interventions WHERE equipment_id = ?", id); err != nil {
			return nil, err
		}
		if _, err := tx.Exec("DELETE FROM equipments WHERE id = ?", id); err != nil {
			return nil, err
		}
		return func() {
			for _, remove := range removals {
				remove()
			}
		}, nil
	})
}

// DeleteTask deletes a task, its interventions and their photos.
func DeleteTask(db *sql.DB, files *attachments.Store, id int) error {
	return deleteInTx(db, func(tx *sql.Tx) (func(), error) {
		return deleteTask(tx, files, id)
	})
}

// DeleteIntervention deletes an intervention and its photos.
func DeleteIntervention(db *sql.DB, files *attachments.Store, id int) error {
	return deleteInTx(db, func(tx *sql.Tx) (func(), error) {
		return deleteInterventions(tx, files, "id = ?", id)
	})
}

// deleteInTx runs del in a transaction, and once it is committed, the removal
// of the files it returns.
func deleteInTx(db *sql.DB, del func(tx *sql.Tx) (removeFiles func(), err error)) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	removeFiles, err := del(tx)
	if err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	removeFiles()
	return nil
}

// deleteTask deletes, in tx, a task, its interventions and their photo rows.
// The caller runs removeFiles once tx is committed.
func deleteTask(tx *sql.Tx, files *attachments.Store, id int) (removeFiles func(), err error) {
	removeFiles, err = deleteInterventions(tx, files, "task_id = ?", id)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec("DELETE FROM tasks WHERE id = ?", id); err != nil {
		return nil, err
	}
	return removeFiles, nil
}

// deleteInterventions deletes, in tx, the interventions matching where and
// their photo rows. The caller runs removeFiles once tx is committed.
func deleteInterventions(tx *sql.Tx, files *attachments.Store, where string, args ...any) (removeFiles func(), err error) {
	photos, err := photosOf(tx, where, args...)
	if err != nil {
		return nil, err
	}
	removeFiles, err = files.DeleteAll(tx, photos...)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec("DELETE FROM interventions WHERE "+where, args...); err != nil {
		return nil, err
	}
	return removeFiles, nil
}

// photosOf names the photos of each intervention matching where. An
// intervention without an equipment predates photos and has none, so it is
// left out.
func photosOf(tx *sql.Tx, where string, args ...any) ([]attachments.Owner, error) {
	rows, err := tx.Query("SELECT id, equipment_id FROM interventions WHERE "+where, args...)
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

// queryIDs returns the ids a query selects.
func queryIDs(tx *sql.Tx, query string, args ...any) ([]int, error) {
	rows, err := tx.Query(query, args...)
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
