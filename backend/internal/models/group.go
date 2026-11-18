package models

import "time"

// Group is a named set of equipments that only organises the Equipments list
// (doc/data-model.md, "Group"). It has no tasks, interventions or status of
// its own.
type Group struct {
	ID        int       `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	Icon      string    `db:"icon" json:"icon"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}
