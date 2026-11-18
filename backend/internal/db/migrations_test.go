package db

import (
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

// openAtSchema creates a database at path built up to schema version v, as a
// binary of that version would have left it.
func openAtSchema(t *testing.T, path string, v int) *sql.DB {
	t.Helper()
	database, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := ensureMetaTable(database); err != nil {
		t.Fatalf("meta table: %v", err)
	}
	if err := bootstrapSchemaVersion(database); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}
	for _, m := range migrations {
		if m.Version > v {
			break
		}
		for _, stmt := range m.SQL {
			if _, err := database.Exec(stmt); err != nil {
				t.Fatalf("migration v%d: %v", m.Version, err)
			}
		}
	}
	if _, err := database.Exec(`UPDATE meta SET value = ? WHERE key = 'schema_version'`, v); err != nil {
		t.Fatalf("schema version: %v", err)
	}
	return database
}

// Issue #99: schema v8 adds expiry tasks; every task already stored becomes
// an interval task, with no current expiry date, and its interventions carry
// no expiry date.
func TestMigrateV7_ExistingTaskBecomesAnIntervalTask(t *testing.T) {
	path := filepath.Join(t.TempDir(), "maintenance.db")
	old := openAtSchema(t, path, 7)
	// Rows as a v7 binary wrote them: an empty description, never NULL.
	now := time.Now()
	date := now.Add(-24 * time.Hour)
	if _, err := old.Exec(`INSERT INTO equipments (id, name, description, created_at, updated_at) VALUES (1, 'Sailboat', '', ?, ?)`, now, now); err != nil {
		t.Fatalf("seed equipment: %v", err)
	}
	if _, err := old.Exec(`INSERT INTO tasks (id, equipment_id, name, description, months_interval, created_at, updated_at) VALUES (1, 1, 'Hull inspection', '', 12, ?, ?)`, now, now); err != nil {
		t.Fatalf("seed task: %v", err)
	}
	if _, err := old.Exec(`INSERT INTO interventions (id, task_id, equipment_id, date, created_at, updated_at) VALUES (1, 1, 1, ?, ?, ?)`, date, now, now); err != nil {
		t.Fatalf("seed intervention: %v", err)
	}
	old.Close()

	database, err := InitDB(path, "test", BackupConfig{Enabled: false})
	if err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	defer database.Close()

	if v, _, err := readSchemaVersion(database); err != nil || v != CurrentSchemaVersion {
		t.Fatalf("schema_version = %d (%v), want %d", v, err, CurrentSchemaVersion)
	}
	task, err := GetTask(database, 1)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if task.Kind != models.KindInterval {
		t.Errorf("kind = %q, want %q", task.Kind, models.KindInterval)
	}
	if task.CurrentExpiryDate != nil {
		t.Errorf("current_expiry_date = %q, want none", *task.CurrentExpiryDate)
	}
	if task.MonthsInterval == nil || *task.MonthsInterval != 12 {
		t.Errorf("months_interval = %v, want 12", task.MonthsInterval)
	}
	inv, err := GetIntervention(database, 1)
	if err != nil {
		t.Fatalf("GetIntervention: %v", err)
	}
	if inv.ExpiryDate != nil {
		t.Errorf("expiry_date = %q, want none", *inv.ExpiryDate)
	}
}

// Issue #112: schema v9 adds groups; every equipment already stored belongs to
// no group, and there is no group yet.
func TestMigrateV8_ExistingEquipmentHasNoGroup(t *testing.T) {
	path := filepath.Join(t.TempDir(), "maintenance.db")
	old := openAtSchema(t, path, 8)
	now := time.Now()
	if _, err := old.Exec(`INSERT INTO equipments (id, name, description, created_at, updated_at) VALUES (1, 'Port winch', '', ?, ?)`, now, now); err != nil {
		t.Fatalf("seed equipment: %v", err)
	}
	old.Close()

	database, err := InitDB(path, "test", BackupConfig{Enabled: false})
	if err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	defer database.Close()

	if v, _, err := readSchemaVersion(database); err != nil || v != CurrentSchemaVersion {
		t.Fatalf("schema_version = %d (%v), want %d", v, err, CurrentSchemaVersion)
	}
	eq, err := GetEquipment(database, 1)
	if err != nil {
		t.Fatalf("GetEquipment: %v", err)
	}
	if eq.GroupID != nil {
		t.Errorf("group_id = %d, want none", *eq.GroupID)
	}
	groups, err := ListGroups(database)
	if err != nil {
		t.Fatalf("ListGroups: %v", err)
	}
	if len(groups) != 0 {
		t.Errorf("groups = %v, want none", groups)
	}
}
