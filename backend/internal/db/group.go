package db

import (
	"database/sql"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

// ListGroups returns every group, in no particular order: clients sort them.
func ListGroups(db *sql.DB) ([]models.Group, error) {
	rows, err := db.Query(`SELECT id, name, icon, created_at, updated_at FROM groups`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	groups := make([]models.Group, 0)
	for rows.Next() {
		var g models.Group
		if err := rows.Scan(&g.ID, &g.Name, &g.Icon, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	return groups, rows.Err()
}

// DefaultGroupIcon is the emoji used when a group has no custom icon.
const DefaultGroupIcon = "🗂️"

// CreateGroup inserts a group as given; the handler checks its name first.
func CreateGroup(db *sql.DB, g *models.Group) error {
	g.CreatedAt = time.Now()
	g.UpdatedAt = g.CreatedAt
	if g.Icon == "" {
		g.Icon = DefaultGroupIcon
	}
	res, err := db.Exec(
		`INSERT INTO groups (name, icon, created_at, updated_at) VALUES (?, ?, ?, ?)`,
		g.Name, g.Icon, g.CreatedAt, g.UpdatedAt,
	)
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	g.ID = int(id)
	return nil
}

func GetGroup(db *sql.DB, id int) (*models.Group, error) {
	g := &models.Group{}
	err := db.QueryRow(`SELECT id, name, icon, created_at, updated_at FROM groups WHERE id = ?`, id).
		Scan(&g.ID, &g.Name, &g.Icon, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return g, nil
}

// UpdateGroup writes a group's name and icon; the handler checks the name.
func UpdateGroup(db *sql.DB, g *models.Group) error {
	g.UpdatedAt = time.Now()
	if g.Icon == "" {
		g.Icon = DefaultGroupIcon
	}
	_, err := db.Exec(`UPDATE groups SET name = ?, icon = ?, updated_at = ? WHERE id = ?`,
		g.Name, g.Icon, g.UpdatedAt, g.ID)
	return err
}

// DeleteGroup removes a group and ungroups its equipments, in one
// transaction. The equipments themselves, their tasks and interventions are
// kept. It returns sql.ErrNoRows when there is no such group.
func DeleteGroup(db *sql.DB, id int) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`UPDATE equipments SET group_id = NULL WHERE group_id = ?`, id); err != nil {
		return err
	}
	res, err := tx.Exec(`DELETE FROM groups WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, err := res.RowsAffected(); err != nil {
		return err
	} else if n == 0 {
		return sql.ErrNoRows
	}
	return tx.Commit()
}
