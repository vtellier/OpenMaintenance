package db

import (
	"database/sql"
	"fmt"
)

// CurrentSchemaVersion is the schema version the running binary expects.
// Bump this and append to `migrations` whenever a schema change is added.
const CurrentSchemaVersion = 6

type migration struct {
	Version int
	SQL     []string
}

// Numbered migrations applied in order. Version 1 is the bootstrap schema;
// real migrations start at 2.
var migrations = []migration{
	{
		Version: 2,
		SQL:     []string{"ALTER TABLE interventions ADD COLUMN performed_by TEXT"},
	},
	{
		Version: 3,
		// SQLite does not support DROP NOT NULL, so we recreate the table.
		// task_id becomes nullable; equipment_id and exceptional_label are added.
		SQL: []string{
			`CREATE TABLE interventions_new (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				task_id INTEGER,
				equipment_id INTEGER,
				exceptional_label TEXT,
				date TIMESTAMP NOT NULL,
				location TEXT,
				performed_by TEXT,
				comments TEXT,
				hours_at REAL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (task_id) REFERENCES tasks(id),
				FOREIGN KEY (equipment_id) REFERENCES equipments(id)
			)`,
			`INSERT INTO interventions_new
				SELECT id, task_id, NULL, NULL, date, location, performed_by, comments, hours_at, created_at, updated_at
				FROM interventions`,
			`DROP TABLE interventions`,
			`ALTER TABLE interventions_new RENAME TO interventions`,
		},
	},
	{
		Version: 4,
		SQL:     []string{"ALTER TABLE equipments ADD COLUMN commissioned_at TEXT"},
	},
	{
		Version: 5,
		SQL: []string{
			`CREATE TABLE equipment_files (
				equipment_id INTEGER NOT NULL,
				file_path TEXT PRIMARY KEY,
				original_name TEXT NOT NULL,
				uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (equipment_id) REFERENCES equipments(id)
			)`,
		},
	},
	{
		Version: 6,
		SQL: []string{
			`CREATE TABLE intervention_files (
				intervention_id INTEGER NOT NULL,
				file_path TEXT PRIMARY KEY,
				original_name TEXT NOT NULL,
				uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (intervention_id) REFERENCES interventions(id)
			)`,
		},
	},
}

// schemaV1Tables defines the schema as of version 1. Used when creating a
// fresh database.
var schemaV1Tables = []string{
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

// legacyAlters catches DBs created by pre-meta binaries that may be missing
// columns added between the first release and the introduction of the meta
// table. Applied exactly once during bootstrap of an existing DB; errors are
// ignored because columns may already exist.
var legacyAlters = []string{
	"ALTER TABLE equipments ADD COLUMN tracks_hours INTEGER NOT NULL DEFAULT 0",
	"ALTER TABLE equipments ADD COLUMN hours REAL",
	"ALTER TABLE equipments ADD COLUMN hours_updated_at TIMESTAMP",
	"ALTER TABLE interventions ADD COLUMN hours_at REAL",
}

func ensureMetaTable(db *sql.DB) error {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS meta (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`)
	return err
}

func readSchemaVersion(db *sql.DB) (int, bool, error) {
	var s string
	err := db.QueryRow(`SELECT value FROM meta WHERE key = 'schema_version'`).Scan(&s)
	if err == sql.ErrNoRows {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	var v int
	if _, err := fmt.Sscanf(s, "%d", &v); err != nil {
		return 0, false, fmt.Errorf("meta.schema_version is not an integer: %q", s)
	}
	return v, true, nil
}

func writeSchemaVersion(tx *sql.Tx, v int) error {
	_, err := tx.Exec(
		`INSERT INTO meta(key, value) VALUES('schema_version', ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		fmt.Sprintf("%d", v),
	)
	return err
}

func tableExists(db *sql.DB, name string) (bool, error) {
	var n string
	err := db.QueryRow(
		`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, name,
	).Scan(&n)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// bootstrapSchemaVersion records an initial schema_version in `meta` if it is
// absent. A fresh DB has the v1 schema created from scratch. An existing DB
// from before the meta table was introduced gets the legacy column ALTERs
// replayed (idempotently) and is marked as v1.
func bootstrapSchemaVersion(db *sql.DB) error {
	if _, present, err := readSchemaVersion(db); err != nil {
		return err
	} else if present {
		return nil
	}

	existing, err := tableExists(db, "equipments")
	if err != nil {
		return err
	}

	if existing {
		for _, a := range legacyAlters {
			db.Exec(a) // best-effort; columns may already exist
		}
	} else {
		for _, stmt := range schemaV1Tables {
			if _, err := db.Exec(stmt); err != nil {
				return fmt.Errorf("create v1 schema: %w", err)
			}
		}
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	if err := writeSchemaVersion(tx, 1); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

func applyPendingMigrations(db *sql.DB) error {
	current, _, err := readSchemaVersion(db)
	if err != nil {
		return err
	}
	for _, m := range migrations {
		if m.Version <= current {
			continue
		}
		if m.Version > CurrentSchemaVersion {
			return fmt.Errorf("migration v%d exceeds CurrentSchemaVersion=%d", m.Version, CurrentSchemaVersion)
		}
		tx, err := db.Begin()
		if err != nil {
			return err
		}
		for _, stmt := range m.SQL {
			if _, err := tx.Exec(stmt); err != nil {
				tx.Rollback()
				return fmt.Errorf("migration v%d failed: %w", m.Version, err)
			}
		}
		if err := writeSchemaVersion(tx, m.Version); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

func refuseFutureDB(db *sql.DB) error {
	current, _, err := readSchemaVersion(db)
	if err != nil {
		return err
	}
	if current > CurrentSchemaVersion {
		return fmt.Errorf(
			"database schema_version=%d is newer than this binary supports (max=%d); upgrade the binary",
			current, CurrentSchemaVersion,
		)
	}
	return nil
}

func writeAppVersion(db *sql.DB, appVersion string) error {
	_, err := db.Exec(
		`INSERT INTO meta(key, value) VALUES('app_version', ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		appVersion,
	)
	return err
}
