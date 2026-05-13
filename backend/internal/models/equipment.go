package models

import "time"

type Equipment struct {
	ID             int        `db:"id" json:"id"`
	Name           string     `db:"name" json:"name"`
	Description    string     `db:"description" json:"description"`
	TracksHours    bool       `db:"tracks_hours" json:"tracks_hours"`
	Hours          *float64   `db:"hours" json:"hours"`
	HoursUpdatedAt *time.Time `db:"hours_updated_at" json:"hours_updated_at"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updated_at"`
}