package models

import "time"

type Equipment struct {
	ID             int     `db:"id" json:"id"`
	Name           string  `db:"name" json:"name"`
	Description    string  `db:"description" json:"description"`
	CommissionedAt *string `db:"commissioned_at" json:"commissioned_at,omitempty"`
	// DecommissionedAt is the YYYY-MM-DD date the equipment left service; nil
	// while it is in service (doc/data-model.md, "Decommissioning").
	DecommissionedAt *string    `db:"decommissioned_at" json:"decommissioned_at"`
	Icon             string     `db:"icon" json:"icon"`
	GroupID          *int       `db:"group_id" json:"group_id"`
	TracksHours      bool       `db:"tracks_hours" json:"tracks_hours"`
	Hours            *float64   `db:"hours" json:"hours"`
	HoursUpdatedAt   *time.Time `db:"hours_updated_at" json:"hours_updated_at"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time  `db:"updated_at" json:"updated_at"`
}

// IsDecommissioned reports whether the equipment has left service: it has a
// decommissioning date. An empty one is none.
func (e Equipment) IsDecommissioned() bool {
	return e.DecommissionedAt != nil && *e.DecommissionedAt != ""
}
