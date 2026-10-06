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
	// Urgency is the fraction of the interval elapsed since the baseline,
	// the greater of the rules that apply: 0 just done, 1 at the due point,
	// above 1 once past. Nil when no rule gives one. Clients rank tasks by
	// Status, then Urgency.
	Urgency *float64
}

// ComputeDueStatus derives a task's due status as of now. The current time is
// a parameter, not read from the wall clock, so callers control it:
// production passes time.Now(), tests pass a fixed instant.
//
// Each rule that applies gives its own status and fraction of its interval
// elapsed. The driving trigger is the rule with the worse status; on the same
// status, the one with the greater fraction; months if equal. Its status is
// the task's, and the greater fraction is its urgency.
//
// A months rule without any baseline date (never performed, no commissioning
// date) is overdue but has no amount and no fraction: on the same status as an
// overdue hours rule the hours rule drives, because it has a concrete amount
// to show, and the urgency comes from the hours rule alone, or is absent.
func ComputeDueStatus(task models.Task, equipment models.Equipment, lastIntervention *models.Intervention, now time.Time) DueStatus {
	baselineDate, hasBaselineDate := dateBaseline(equipment, lastIntervention)
	var baselineHours float64

	if lastIntervention != nil && lastIntervention.HoursAt != nil {
		baselineHours = *lastIntervention.HoursAt
	}

	due := DueStatus{Status: "ok"}
	// "" while a rule does not apply.
	var monthsStatus, hoursStatus string
	// nil while a rule does not apply or has no fraction: its interval is not
	// positive, or it has no baseline date.
	var monthsFraction, hoursFraction *float64
	monthsHasAmount := true

	if task.MonthsInterval != nil {
		if !hasBaselineDate {
			// Never performed and no commissioning date: there is no way to
			// know when the task is due, so it is reported overdue, with no
			// next due date, no amount and no fraction, rather than
			// inventing one.
			monthsStatus = "overdue"
			monthsHasAmount = false
		} else {
			nextDate := baselineDate.AddDate(0, *task.MonthsInterval, 0)
			due.NextDueDate = nextDate.Format("2006-01-02")
			days := calendarDaysUntil(nextDate, now)
			due.DueInDays = &days
			// Elapsed / interval in calendar days: the baseline's date to the
			// due date, minus the days still to go.
			if intervalDays := calendarDaysUntil(nextDate, baselineDate); intervalDays > 0 {
				f := float64(intervalDays-days) / float64(intervalDays)
				monthsFraction = &f
			}

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
			if *task.HoursInterval > 0 {
				f := (currentHours - baselineHours) / float64(*task.HoursInterval)
				hoursFraction = &f
			}

			hoursStatus = "ok"
			if currentHours >= nextHours {
				hoursStatus = "overdue"
			} else if currentHours >= nextHours-hoursDueSoonMargin {
				hoursStatus = "due_soon"
			}
		}
	}

	switch {
	case monthsStatus != "" && monthsDrive(monthsStatus, hoursStatus, monthsHasAmount, monthsFraction, hoursFraction):
		due.Trigger, due.Status = TriggerMonths, monthsStatus
	case hoursStatus != "":
		due.Trigger, due.Status = TriggerHours, hoursStatus
	}
	due.Urgency = greater(monthsFraction, hoursFraction)

	return due
}

// monthsDrive reports whether the months rule, which applies, drives rather
// than the hours rule: hours does not apply, or months has the worse status,
// or the same status and a fraction elapsed at least as great. A months rule
// with no amount (no date baseline) yields to an hours rule on the same status.
func monthsDrive(monthsStatus, hoursStatus string, monthsHasAmount bool, monthsFraction, hoursFraction *float64) bool {
	if statusRank(monthsStatus) != statusRank(hoursStatus) {
		return statusRank(monthsStatus) > statusRank(hoursStatus)
	}
	if !monthsHasAmount {
		return false
	}
	return greater(monthsFraction, hoursFraction) == monthsFraction
}

// greater returns the greater of two optional fractions, a when they are
// equal, nil when both are nil.
func greater(a, b *float64) *float64 {
	switch {
	case a == nil:
		return b
	case b == nil || *a >= *b:
		return a
	}
	return b
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
