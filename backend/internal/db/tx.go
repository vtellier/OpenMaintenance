package db

import "database/sql"

// InTx runs fn in one transaction, committed only when fn succeeds: writes
// that belong together, such as an intervention and the hour-meter reading it
// raises, are stored together or not at all.
func InTx(db *sql.DB, fn func(tx *sql.Tx) error) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() // no-op once committed

	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit()
}
