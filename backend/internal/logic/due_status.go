package logic

import (
	"math"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

const hoursDueSoonMargin = 10.0
const monthsDueSoonMargin = 30 * 24 * time.Hour

// calendarDateLayout is the storage format of the TEXT columns holding a
// plain calendar date: equipments.commissioned_at,
// tasks.current_expiry_date and interventions.expiry_date.
const calendarDateLayout = "2006-01-02"

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
		if commissioned, err := time.Parse(calendarDateLayout, *equipment.CommissionedAt); err == nil && !commissioned.IsZero() {
			return commissioned, true
		}
	}

	return time.Time{}, false
}

// Driving triggers of a due status.
const (
	TriggerMonths = "months"
	TriggerHours  = "hours"
	TriggerExpiry = "expiry"
)

// DueStatus is a task's derived due status. See "Derived: due status" in
// doc/data-model.md.
type DueStatus struct {
	// Status is "overdue", "due_soon" or "ok".
	Status string
	// NextDueDate is the months rule's due date or, for an expiry task, the
	// current expiry date. "" when neither rule gives a date.
	NextDueDate string
	// NextDueHours is nil when the task has no hours rule on this equipment.
	NextDueHours *float64
	// Trigger is the rule that drives Status (TriggerMonths, TriggerHours
	// or, for an expiry task, always TriggerExpiry), or "" when no rule
	// applies.
	Trigger string
	// DueInDays is the whole calendar days to NextDueDate, negative once
	// past. Nil when NextDueDate is "".
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

// ComputeDueStatus derives a task's due status as of now, from the task's
// interventions, in any order. The current time is
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
func ComputeDueStatus(task models.Task, equipment models.Equipment, interventions []models.Intervention, now time.Time) DueStatus {
	if task.IsExpiry() {
		return expiryDueStatus(task, interventions, now)
	}

	lastIntervention := latest(interventions)
	baselineDate, hasBaselineDate := dateBaseline(equipment, lastIntervention)
	baselineHours, hasBaselineHours := hoursBaseline(interventions)

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
			nextDate := addMonths(baselineDate, *task.MonthsInterval)
			due.NextDueDate = nextDate.Format("2006-01-02")
			days := calendarDaysUntil(nextDate, now)
			due.DueInDays = &days
			// Elapsed / interval in calendar days: the baseline's date to the
			// due date, minus the days still to go.
			if intervalDays := calendarDaysUntil(nextDate, baselineDate); intervalDays > 0 {
				f := float64(intervalDays-days) / float64(intervalDays)
				monthsFraction = &f
			}

			monthsStatus = dateRuleStatus(nextDate, now)
		}
	}

	// Without an hours baseline (performed, never with a reading) the hours
	// rule gives nothing: counting from 0 would make the task overdue right
	// after it was done (#81).
	if task.HoursInterval != nil && equipment.TracksHours && hasBaselineHours {
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

// fittedExpiredUrgency is the urgency of an expiry task whose part was
// fitted already expired: the largest double, above any fraction.
const fittedExpiredUrgency = math.MaxFloat64

// expiryDueStatus derives an expiry task's due status: it is due on the
// expiry date of the part fitted by the latest intervention. See "Expiry
// rule" in doc/data-model.md.
func expiryDueStatus(task models.Task, interventions []models.Intervention, now time.Time) DueStatus {
	due := DueStatus{Trigger: TriggerExpiry}
	last := latest(interventions)
	expiry, ok := currentExpiryDate(task, last)
	if !ok {
		// No part with a known expiry date: there is no way to know when the
		// task is due, so it is reported overdue with no date, rather than
		// inventing one.
		due.Status = "overdue"
		return due
	}

	due.NextDueDate = expiry.Format("2006-01-02")
	days := calendarDaysUntil(expiry, now)
	due.DueInDays = &days
	due.Status = dateRuleStatus(expiry, now)

	// With only the task's current expiry date there is no date fitted to
	// measure from: no urgency.
	if last != nil {
		// The fraction of the shelf life left when fitted that has elapsed.
		// A part fitted already expired has none to divide by: it ranks at
		// the top of the overdue tasks.
		f := fittedExpiredUrgency
		if shelfLife := calendarDaysUntil(expiry, last.Date); shelfLife > 0 {
			f = float64(shelfLife-days) / float64(shelfLife)
		}
		due.Urgency = &f
	}
	return due
}

// currentExpiryDate returns the expiry date an expiry task is due on, and
// false when there is none: the latest intervention's expiry date, else,
// before any intervention, the task's current expiry date. A missing or
// malformed date means there is none (never a zero time).
func currentExpiryDate(task models.Task, last *models.Intervention) (time.Time, bool) {
	date := task.CurrentExpiryDate
	if last != nil {
		date = last.ExpiryDate
	}
	if date == nil {
		return time.Time{}, false
	}
	expiry, err := time.Parse(calendarDateLayout, *date)
	if err != nil || expiry.IsZero() {
		return time.Time{}, false
	}
	return expiry, true
}

// dateRuleStatus is the status of a rule due on a date: overdue once the date
// has started, due soon within the 30 days before it, ok before that.
func dateRuleStatus(dueDate, now time.Time) string {
	switch {
	case now.After(dueDate):
		return "overdue"
	case now.After(dueDate.Add(-monthsDueSoonMargin)):
		return "due_soon"
	}
	return "ok"
}

// hoursBaseline returns the reading a task's hour-based interval is counted
// from, and false when there is none.
//
// It is the hours_at of the most recent intervention that has one;
// interventions logged without a reading are skipped. A task never performed
// counts from 0. A task performed, but never with a reading, has no baseline.
func hoursBaseline(interventions []models.Intervention) (float64, bool) {
	if len(interventions) == 0 {
		return 0, true
	}
	var withReading []models.Intervention
	for _, inv := range interventions {
		if inv.HoursAt != nil {
			withReading = append(withReading, inv)
		}
	}
	if last := latest(withReading); last != nil {
		return *last.HoursAt, true
	}
	return 0, false
}

// addMonths returns t plus n calendar months, on the same day of the month,
// or the target month's last day when that day does not exist there: Jan 31
// + 1 month is Feb 28, not Mar 3 as time.AddDate gives (#80).
func addMonths(t time.Time, n int) time.Time {
	first := time.Date(t.Year(), t.Month()+time.Month(n), 1, t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), t.Location())
	lastDay := first.AddDate(0, 1, -1).Day()
	return first.AddDate(0, 0, min(t.Day(), lastDay)-1)
}

// latest returns the most recent of interventions by date, the later logged
// (higher id) on the same date, or nil when there are none.
func latest(interventions []models.Intervention) *models.Intervention {
	var last *models.Intervention
	for i := range interventions {
		inv := &interventions[i]
		if last == nil || inv.Date.After(last.Date) || (inv.Date.Equal(last.Date) && inv.ID > last.ID) {
			last = inv
		}
	}
	return last
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
