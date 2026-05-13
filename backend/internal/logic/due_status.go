package logic

import (
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

const hoursDueSoonMargin = 10.0
const monthsDueSoonMargin = 30 * 24 * time.Hour

func ComputeDueStatus(task models.Task, equipment models.Equipment, lastIntervention *models.Intervention) (status string, nextDueDate string, nextDueHours *float64) {
	baselineDate := equipment.CreatedAt
	var baselineHours float64

	if lastIntervention != nil {
		baselineDate = lastIntervention.Date
		if lastIntervention.HoursAt != nil {
			baselineHours = *lastIntervention.HoursAt
		}
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
