package models

import "time"

type Intervention struct {
	ID          int       `db:"id" json:"id"`
	TaskID      int       `db:"task_id" json:"task_id"`
	Date        time.Time `db:"date" json:"date"`
	Location    *string   `db:"location" json:"location,omitempty"`
	PerformedBy *string   `db:"performed_by" json:"performed_by,omitempty"`
	Comments    *string   `db:"comments" json:"comments,omitempty"`
	HoursAt     *float64  `db:"hours_at" json:"hours_at"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}