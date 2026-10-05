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

// dateBaseline returns the date a task's time-based interval is counted from,
// and false when there is none.
//
// Precedence:
//  1. the last intervention's date — the task was actually performed then;
//  2. the equipment's commissioned_at — when the equipment entered service.
//
// equipment.created_at is never a baseline: it is only when the row was
// inserted in this app. A nil, empty or malformed commissioned_at means there
// is no baseline (never a zero time).
func dateBaseline(equipment models.Equipment, lastIntervention *models.Intervention) (time.Time, bool) {
	if lastIntervention != nil {
		return lastIntervention.Date, true
	}

	if equipment.CommissionedAt != nil {
		if commissioned, err := time.Parse(commissionedAtLayout, *equipment.CommissionedAt); err == nil && !commissioned.IsZero() {
			return commissioned, true
		}
	}

	return time.Time{}, false
}

// ComputeDueStatus derives a task's due status, next due date and next due
// hours as of now. The current time is a parameter, not read from the wall
// clock, so callers control it: production passes time.Now(), tests pass a
// fixed instant.
func ComputeDueStatus(task models.Task, equipment models.Equipment, lastIntervention *models.Intervention, now time.Time) (status string, nextDueDate string, nextDueHours *float64) {
	baselineDate, hasBaselineDate := dateBaseline(equipment, lastIntervention)
	var baselineHours float64

	if lastIntervention != nil && lastIntervention.HoursAt != nil {
		baselineHours = *lastIntervention.HoursAt
	}

	overallStatus := "ok"

	if task.MonthsInterval != nil {
		if !hasBaselineDate {
			// Never performed and no commissioning date: there is no way to
			// know when the task is due, so it is reported overdue rather than
			// inventing a next due date.
			overallStatus = worstStatus(overallStatus, "overdue")
		} else {
			nextDate := baselineDate.AddDate(0, *task.MonthsInterval, 0)
			nextDueDate = nextDate.Format("2006-01-02")

			if now.After(nextDate) {
				overallStatus = worstStatus(overallStatus, "overdue")
			} else if now.After(nextDate.Add(-monthsDueSoonMargin)) {
				overallStatus = worstStatus(overallStatus, "due_soon")
			}
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
