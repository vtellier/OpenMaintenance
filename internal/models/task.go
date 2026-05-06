package models

import "time"

type Task struct {
	ID            int       `db:"id" json:"id"`
	EquipmentID   int       `db:"equipment_id" json:"equipment_id"`
	Name          string    `db:"name" json:"name"`
	Description   string    `db:"description" json:"description"`
	HoursInterval *int      `db:"hours_interval" json:"hours_interval,omitempty"`
	MonthsInterval *int     `db:"months_interval" json:"months_interval,omitempty"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time `db:"updated_at" json:"updated_at"`
}