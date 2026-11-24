package db

import (
	"database/sql"

	_ "github.com/mattn/go-sqlite3"
	"github.com/vtellier/OpenMaintenance/internal/filestore"
)

func InitDB(dbPath, appVersion string, backupCfg BackupConfig) (*sql.DB, error) {
	dbPath, err := filestore.ResolveDBPath(dbPath)
	if err != nil {
		return nil, err
	}

	if err := BackupDB(dbPath, backupCfg); err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := ensureMetaTable(db); err != nil {
		db.Close()
		return nil, err
	}
	if err := refuseFutureDB(db); err != nil {
		db.Close()
		return nil, err
	}
	if err := bootstrapSchemaVersion(db); err != nil {
		db.Close()
		return nil, err
	}
	if err := applyPendingMigrations(db); err != nil {
		db.Close()
		return nil, err
	}
	if err := writeAppVersion(db, appVersion); err != nil {
		db.Close()
		return nil, err
	}

	return db, nil
}
