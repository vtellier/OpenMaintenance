package models

import "time"

// Task kinds. See "Task kinds" in doc/data-model.md.
const (
	KindInterval = "interval"
	KindExpiry   = "expiry"
)

// IsExpiry reports whether the task is an expiry task.
func (t Task) IsExpiry() bool { return t.Kind == KindExpiry }

type Task struct {
	ID          int    `db:"id" json:"id"`
	EquipmentID int    `db:"equipment_id" json:"equipment_id"`
	Name        string `db:"name" json:"name"`
	Description string `db:"description" json:"description"`
	// Kind is KindInterval or KindExpiry; "" reads as KindInterval.
	Kind           string `db:"kind" json:"kind"`
	HoursInterval  *int   `db:"hours_interval" json:"hours_interval,omitempty"`
	MonthsInterval *int   `db:"months_interval" json:"months_interval,omitempty"`
	// CurrentExpiryDate is a YYYY-MM-DD calendar date, expiry tasks only.
	CurrentExpiryDate *string   `db:"current_expiry_date" json:"current_expiry_date,omitempty"`
	DueStatus         string    `json:"due_status,omitempty"`
	NextDueDate       string    `json:"next_due_date,omitempty"`
	NextDueHours      *float64  `json:"next_due_hours,omitempty"`
	DueTrigger        string    `json:"due_trigger,omitempty"`
	DueInDays         *int      `json:"due_in_days,omitempty"`
	DueInHours        *float64  `json:"due_in_hours,omitempty"`
	Urgency           *float64  `json:"urgency,omitempty"`
	CreatedAt         time.Time `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time `db:"updated_at" json:"updated_at"`
}
