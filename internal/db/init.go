package db

import (
	"database/sql"
	_ "github.com/mattn/go-sqlite3"
)

func InitDB() (*sql.DB, error) {
	db, err := sql.Open("sqlite3", "./maintenance.db")
	if err != nil {
		return nil, err
	}

	// Create tables if they don't exist
	tables := []string{
		`CREATE TABLE IF NOT EXISTS equipments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT,
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

	return db, nil
}