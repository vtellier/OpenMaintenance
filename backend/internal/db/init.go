package db

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

func InitDB(dbPath string) (*sql.DB, error) {
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

	// Create tables if they don't exist
	tables := []string{
		`CREATE TABLE IF NOT EXISTS equipments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT,
			tracks_hours INTEGER NOT NULL DEFAULT 0,
			hours REAL,
			hours_updated_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS tasks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			equipment_id INTEGER NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			hours_interval INTEGER,
			months_interval INTEGER,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (equipment_id) REFERENCES equipments(id)
		)`,
		`CREATE TABLE IF NOT EXISTS interventions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			task_id INTEGER NOT NULL,
			date TIMESTAMP NOT NULL,
			location TEXT,
			comments TEXT,
			hours_at REAL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (task_id) REFERENCES tasks(id)
		)`,
	}

	for _, table := range tables {
		_, err = db.Exec(table)
		if err != nil {
			return nil, err
		}
	}

	// Migrations for existing databases
	migrations := []string{
		"ALTER TABLE equipments ADD COLUMN tracks_hours INTEGER NOT NULL DEFAULT 0",
		"ALTER TABLE equipments ADD COLUMN hours REAL",
		"ALTER TABLE equipments ADD COLUMN hours_updated_at TIMESTAMP",
		"ALTER TABLE interventions ADD COLUMN hours_at REAL",
	}
	for _, m := range migrations {
		db.Exec(m) // ignore errors (column may already exist)
	}

	return db, nil
}