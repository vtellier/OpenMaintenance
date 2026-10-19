package models

import "time"

type Intervention struct {
	ID               int       `db:"id" json:"id"`
	TaskID           *int      `db:"task_id" json:"task_id"`
	EquipmentID      *int      `db:"equipment_id" json:"equipment_id"`
	ExceptionalLabel *string   `db:"exceptional_label" json:"exceptional_label,omitempty"`
	Date             time.Time `db:"date" json:"date"`
	Location         *string   `db:"location" json:"location,omitempty"`
	PerformedBy      *string   `db:"performed_by" json:"performed_by,omitempty"`
	Comments         *string   `db:"comments" json:"comments,omitempty"`
	HoursAt          *float64  `db:"hours_at" json:"hours_at"`
	// ExpiryDate is the YYYY-MM-DD expiry date of the part fitted, on an
	// expiry task's interventions only.
	ExpiryDate *string   `db:"expiry_date" json:"expiry_date,omitempty"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time `db:"updated_at" json:"updated_at"`
	// PhotoCount is computed at read time, not stored on the interventions table.
	PhotoCount int `db:"-" json:"photo_count"`
}
