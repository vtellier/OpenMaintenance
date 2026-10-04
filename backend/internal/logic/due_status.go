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

// Driving triggers of a due status.
const (
	TriggerMonths = "months"
	TriggerHours  = "hours"
)

// DueStatus is a task's derived due status. See "Derived: due status" in
// doc/data-model.md.
type DueStatus struct {
	// Status is "overdue", "due_soon" or "ok".
	Status string
	// NextDueDate is "" when the months rule does not apply.
	NextDueDate string
	// NextDueHours is nil when the task has no hours rule on this equipment.
	NextDueHours *float64
	// Trigger is the rule that drives Status (TriggerMonths or
	// TriggerHours), or "" when no rule applies.
	Trigger string
	// DueInDays is the whole calendar days to NextDueDate, negative once
	// past. Nil when the months rule does not apply.
	DueInDays *int
	// DueInHours is NextDueHours minus the current reading, negative once
	// reached or passed. Nil when the hours rule does not apply.
	DueInHours *float64
}

// ComputeDueStatus derives a task's due status as of now. The current time is
// a parameter, not read from the wall clock, so callers control it:
// production passes time.Now(), tests pass a fixed instant.
//
// Each rule that applies gives its own status. The driving trigger is the
// rule with the worse status, months on a tie, and its status is the task's.
// The exception is a months rule without any baseline date (never performed,
// no commissioning date): it is overdue but has no amount, so on a tie with
// an overdue hours rule the hours rule drives, because it has a concrete
// amount to show.
func ComputeDueStatus(task models.Task, equipment models.Equipment, lastIntervention *models.Intervention, now time.Time) DueStatus {
	baselineDate, hasBaselineDate := dateBaseline(equipment, lastIntervention)
	var baselineHours float64

	if lastIntervention != nil && lastIntervention.HoursAt != nil {
		baselineHours = *lastIntervention.HoursAt
	}

	due := DueStatus{Status: "ok"}
	// "" while a rule does not apply.
	var monthsStatus, hoursStatus string
	monthsHasAmount := true

	if task.MonthsInterval != nil {
		if !hasBaselineDate {
			// Never performed and no commissioning date: there is no way to
			// know when the task is due, so it is reported overdue, with no
			// next due date and no amount, rather than inventing one.
			monthsStatus = "overdue"
			monthsHasAmount = false
		} else {
			nextDate := baselineDate.AddDate(0, *task.MonthsInterval, 0)
			due.NextDueDate = nextDate.Format("2006-01-02")
			days := calendarDaysUntil(nextDate, now)
			due.DueInDays = &days

			monthsStatus = "ok"
			if now.After(nextDate) {
				monthsStatus = "overdue"
			} else if now.After(nextDate.Add(-monthsDueSoonMargin)) {
				monthsStatus = "due_soon"
			}
		}
	}

	if task.HoursInterval != nil && equipment.TracksHours {
		nextHours := baselineHours + float64(*task.HoursInterval)
		due.NextDueHours = &nextHours

		if equipment.Hours != nil {
			currentHours := *equipment.Hours
			inHours := nextHours - currentHours
			due.DueInHours = &inHours

			hoursStatus = "ok"
			if currentHours >= nextHours {
				hoursStatus = "overdue"
			} else if currentHours >= nextHours-hoursDueSoonMargin {
				hoursStatus = "due_soon"
			}
		}
	}

	// Months wins a tie, unless it has no amount to show (see above).
	monthsWins := statusRank(monthsStatus) > statusRank(hoursStatus) ||
		(monthsHasAmount && statusRank(monthsStatus) == statusRank(hoursStatus))

	switch {
	case monthsStatus != "" && monthsWins:
		due.Trigger, due.Status = TriggerMonths, monthsStatus
	case hoursStatus != "":
		due.Trigger, due.Status = TriggerHours, hoursStatus
	}

	return due
}

// calendarDaysUntil returns the whole calendar days from now's date to due's
// date, both read in due's location (the one next_due_date is formatted in):
// positive while due is ahead, 0 on the same date, negative once past.
//
// This is the one place the day amount is computed. When calendar dates
// become plain YYYY-MM-DD values (#72), adjust it here.
func calendarDaysUntil(due, now time.Time) int {
	n := now.In(due.Location())
	dueDay := time.Date(due.Year(), due.Month(), due.Day(), 0, 0, 0, 0, time.UTC)
	today := time.Date(n.Year(), n.Month(), n.Day(), 0, 0, 0, 0, time.UTC)
	return int((dueDay.Unix() - today.Unix()) / (24 * 60 * 60))
}

// statusRank orders statuses from best to worst; "" (rule does not apply)
// ranks below "ok".
func statusRank(status string) int {
	switch status {
	case "ok":
		return 1
	case "due_soon":
		return 2
	case "overdue":
		return 3
	}
	return 0
}
