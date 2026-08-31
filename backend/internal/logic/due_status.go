package logic

import (
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

const hoursDueSoonMargin = 10.0
const monthsDueSoonMargin = 30 * 24 * time.Hour

// commissionedAtLayout is the storage format of equipments.commissioned_at
// (a TEXT column holding a plain calendar date).
const commissionedAtLayout = "2006-01-02"

// dateBaseline returns the date a task's time-based interval is counted from.
//
// Precedence:
//  1. the last intervention's date — the task was actually performed then;
//  2. the equipment's commissioned_at — when the equipment entered service;
//  3. the equipment's created_at — when the row was inserted in this app.
//
// commissioned_at is optional and free-form enough to be unusable (nil, empty
// or malformed); in that case we fall through to created_at rather than
// yielding a zero time, which would make every task look overdue.
func dateBaseline(equipment models.Equipment, lastIntervention *models.Intervention) time.Time {
	if lastIntervention != nil {
		return lastIntervention.Date
	}

	if equipment.CommissionedAt != nil {
		if commissioned, err := time.Parse(commissionedAtLayout, *equipment.CommissionedAt); err == nil && !commissioned.IsZero() {
			return commissioned
		}
	}

	return equipment.CreatedAt
}

func ComputeDueStatus(task models.Task, equipment models.Equipment, lastIntervention *models.Intervention) (status string, nextDueDate string, nextDueHours *float64) {
	baselineDate := dateBaseline(equipment, lastIntervention)
	var baselineHours float64

	if lastIntervention != nil && lastIntervention.HoursAt != nil {
		baselineHours = *lastIntervention.HoursAt
	}

	now := time.Now()
	overallStatus := "ok"

	if task.MonthsInterval != nil {
		nextDate := baselineDate.AddDate(0, *task.MonthsInterval, 0)
		nextDueDate = nextDate.Format("2006-01-02")

		if now.After(nextDate) {
			overallStatus = worstStatus(overallStatus, "overdue")
		} else if now.After(nextDate.Add(-monthsDueSoonMargin)) {
			overallStatus = worstStatus(overallStatus, "due_soon")
		}
	}

	if task.HoursInterval != nil && equipment.TracksHours {
		nextHours := baselineHours + float64(*task.HoursInterval)
		nextDueHours = &nextHours

		if equipment.Hours != nil {
			currentHours := *equipment.Hours
			if currentHours >= nextHours {
				overallStatus = worstStatus(overallStatus, "overdue")
			} else if currentHours >= nextHours-hoursDueSoonMargin {
				overallStatus = worstStatus(overallStatus, "due_soon")
			}
		}
	}

	status = overallStatus
	return
}

func worstStatus(a, b string) string {
	order := map[string]int{"ok": 0, "due_soon": 1, "overdue": 2}
	if order[a] > order[b] {
		return a
	}
	return b
}
