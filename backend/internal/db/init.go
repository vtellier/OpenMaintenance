package db

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

func InitDB(dbPath, appVersion string) (*sql.DB, error) {
	if !filepath.IsAbs(dbPath) {
		exe, err := os.Executable()
		if err != nil {
			return nil, err
		}
		dbPath = filepath.Join(filepath.Dir(exe), dbPath)
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
