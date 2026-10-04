package logic

import (
	"testing"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

// Fixed-clock tests for ComputeDueStatus: every rule of the due status
// (Overdue / Due soon / OK, next due date, next due hours) checked at pinned
// instants instead of whenever the test happens to run.
//
// The cases pin the CURRENT behaviour. Where it is surprising, or the spec in
// doc/data-model.md does not say, the case carries a "Current behaviour:"
// comment. Those are findings, not changes: if one is changed, change the
// case on purpose.
//
// Extending: add a field to dueStatusWant, assert it in runDueStatusCases and
// fill it in the tables (e.g. the driving trigger and the amount past or
// remaining, issue #67).

// testNow is the default fixed clock: mid-month and mid-day, so a case only
// sits on a month end or a midnight when it means to.
var testNow = time.Date(2026, time.June, 15, 12, 0, 0, 0, time.UTC)

// at returns an instant in UTC, the location timestamps come back from the
// database in.
func at(year int, month time.Month, day, hour, min int) time.Time {
	return time.Date(year, month, day, hour, min, 0, 0, time.UTC)
}

// midnight returns 00:00 UTC on the given day: an intervention date logged
// from a UTC browser, and any parsed commissioned_at.
func midnight(year int, month time.Month, day int) time.Time {
	return at(year, month, day, 0, 0)
}

func monthsTask(months int) models.Task {
	return models.Task{MonthsInterval: intPtr(months)}
}

func hoursTask(hours int) models.Task {
	return models.Task{HoursInterval: intPtr(hours)}
}

func bothTask(months, hours int) models.Task {
	return models.Task{MonthsInterval: intPtr(months), HoursInterval: intPtr(hours)}
}

// equipmentCreatedAt fills the field only: created_at is never a baseline (#62).
var equipmentCreatedAt = midnight(2020, time.January, 1)

// noMeter is an equipment that does not track hours.
func noMeter() models.Equipment {
	return models.Equipment{CreatedAt: equipmentCreatedAt}
}

// meter is an hour-tracked equipment whose current reading is hours.
func meter(hours float64) models.Equipment {
	return models.Equipment{TracksHours: true, Hours: floatPtr(hours), CreatedAt: equipmentCreatedAt}
}

// done is a last intervention without an hour reading.
func done(date time.Time) *models.Intervention {
	return &models.Intervention{Date: date}
}

// doneAt is a last intervention with an hour reading.
func doneAt(date time.Time, hours float64) *models.Intervention {
	return &models.Intervention{Date: date, HoursAt: floatPtr(hours)}
}

type dueStatusWant struct {
	status       string
	nextDueDate  string   // "" when the months rule does not apply
	nextDueHours *float64 // nil when the hours rule does not apply
}

type dueStatusCase struct {
	name      string
	now       time.Time
	task      models.Task
	equipment models.Equipment
	last      *models.Intervention
	want      dueStatusWant
}

func runDueStatusCases(t *testing.T, cases []dueStatusCase) {
	t.Helper()
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.now.IsZero() {
				t.Fatal("case must pin now")
			}

			status, nextDueDate, nextDueHours := ComputeDueStatus(tc.task, tc.equipment, tc.last, tc.now)

			if status != tc.want.status {
				t.Errorf("status = %q, want %q", status, tc.want.status)
			}
			if nextDueDate != tc.want.nextDueDate {
				t.Errorf("nextDueDate = %q, want %q", nextDueDate, tc.want.nextDueDate)
			}
			switch {
			case tc.want.nextDueHours == nil && nextDueHours != nil:
				t.Errorf("nextDueHours = %v, want nil", *nextDueHours)
			case tc.want.nextDueHours != nil && nextDueHours == nil:
				t.Errorf("nextDueHours = nil, want %v", *tc.want.nextDueHours)
			case tc.want.nextDueHours != nil && *nextDueHours != *tc.want.nextDueHours:
				t.Errorf("nextDueHours = %v, want %v", *nextDueHours, *tc.want.nextDueHours)
			}
		})
	}
}

func TestComputeDueStatusMonthsOnly(t *testing.T) {
	runDueStatusCases(t, []dueStatusCase{
		{
			name:      "ok before the due-soon window",
			now:       testNow,
			task:      monthsTask(6),
			equipment: noMeter(),
			last:      done(midnight(2026, time.March, 1)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-09-01"},
		},
		{
			name:      "due soon inside the 30-day window",
			now:       testNow,
			task:      monthsTask(6),
			equipment: noMeter(),
			last:      done(midnight(2025, time.December, 25)),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-06-25"},
		},
		{
			name:      "overdue past the due date",
			now:       testNow,
			task:      monthsTask(6),
			equipment: noMeter(),
			last:      done(midnight(2025, time.November, 1)),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-05-01"},
		},
		{
			name:      "hour reading plays no part",
			now:       testNow,
			task:      monthsTask(6),
			equipment: meter(5000),
			last:      doneAt(midnight(2026, time.March, 1), 0),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-09-01"},
		},
	})
}

func TestComputeDueStatusHoursOnly(t *testing.T) {
	runDueStatusCases(t, []dueStatusCase{
		{
			name:      "ok below the due-soon margin",
			now:       testNow,
			task:      hoursTask(100),
			equipment: meter(520),
			last:      doneAt(midnight(2026, time.March, 1), 500),
			want:      dueStatusWant{status: "ok", nextDueHours: floatPtr(600)},
		},
		{
			name:      "due soon inside the 10 h margin",
			now:       testNow,
			task:      hoursTask(100),
			equipment: meter(595),
			last:      doneAt(midnight(2026, time.March, 1), 500),
			want:      dueStatusWant{status: "due_soon", nextDueHours: floatPtr(600)},
		},
		{
			name:      "overdue past the due reading",
			now:       testNow,
			task:      hoursTask(100),
			equipment: meter(650),
			last:      doneAt(midnight(2026, time.March, 1), 500),
			want:      dueStatusWant{status: "overdue", nextDueHours: floatPtr(600)},
		},
		{
			name:      "fractional readings",
			now:       testNow,
			task:      hoursTask(100),
			equipment: meter(600.4),
			last:      doneAt(midnight(2026, time.March, 1), 500.5),
			want:      dueStatusWant{status: "due_soon", nextDueHours: floatPtr(600.5)},
		},
		{
			name:      "time elapsed plays no part",
			now:       testNow,
			task:      hoursTask(100),
			equipment: meter(520),
			last:      doneAt(midnight(2016, time.January, 1), 500),
			want:      dueStatusWant{status: "ok", nextDueHours: floatPtr(600)},
		},
		{
			// No reading on the equipment yet: the next due reading is known,
			// but there is nothing to compare it with.
			name:      "no current reading gives next due hours but no status",
			now:       testNow,
			task:      hoursTask(100),
			equipment: models.Equipment{TracksHours: true, CreatedAt: equipmentCreatedAt},
			last:      doneAt(midnight(2026, time.March, 1), 500),
			want:      dueStatusWant{status: "ok", nextDueHours: floatPtr(600)},
		},
	})
}

// Both intervals: the task is due whenever either condition is met first, so
// the worse of the two statuses wins and both next-due values are returned.
func TestComputeDueStatusBothIntervals(t *testing.T) {
	runDueStatusCases(t, []dueStatusCase{
		{
			name:      "both ok",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(520),
			last:      doneAt(midnight(2026, time.March, 1), 500),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-09-01", nextDueHours: floatPtr(600)},
		},
		{
			name:      "months due soon, hours ok",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(520),
			last:      doneAt(midnight(2025, time.December, 25), 500),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-06-25", nextDueHours: floatPtr(600)},
		},
		{
			name:      "hours due soon, months ok",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(595),
			last:      doneAt(midnight(2026, time.March, 1), 500),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-09-01", nextDueHours: floatPtr(600)},
		},
		{
			name:      "months overdue, hours ok",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(520),
			last:      doneAt(midnight(2025, time.November, 1), 500),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-05-01", nextDueHours: floatPtr(600)},
		},
		{
			// The next due date is still in the future: the date alone does
			// not tell which trigger drives the status (see #52, #67).
			name:      "hours overdue, months ok",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(650),
			last:      doneAt(midnight(2026, time.March, 1), 500),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-09-01", nextDueHours: floatPtr(600)},
		},
		{
			name:      "months overdue, hours due soon",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(595),
			last:      doneAt(midnight(2025, time.November, 1), 500),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-05-01", nextDueHours: floatPtr(600)},
		},
		{
			name:      "months due soon, hours overdue",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(650),
			last:      doneAt(midnight(2025, time.December, 25), 500),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-06-25", nextDueHours: floatPtr(600)},
		},
	})
}

// No intervention yet: the date baseline is commissioned_at when set and
// valid; otherwise there is none and a time-based interval is overdue (see
// #59 / #62). The hours baseline is 0.
func TestComputeDueStatusNoInterventionYet(t *testing.T) {
	runDueStatusCases(t, []dueStatusCase{
		{
			name: "months counted from commissioned_at",
			now:  testNow,
			task: monthsTask(6),
			equipment: models.Equipment{
				CommissionedAt: strPtr("2025-12-01"),
				CreatedAt:      at(2026, time.June, 1, 10, 0),
			},
			want: dueStatusWant{status: "overdue", nextDueDate: "2026-06-01"},
		},
		{
			// Per #62: equipment.created_at is never a baseline, however recent.
			// With no intervention and no commissioned_at there is nothing to
			// count from, so the task is overdue and no next due date is given.
			name: "no commissioned_at: overdue, no next due date, created_at ignored",
			now:  testNow,
			task: monthsTask(6),
			equipment: models.Equipment{
				CreatedAt: at(2026, time.June, 1, 10, 0),
			},
			want: dueStatusWant{status: "overdue"},
		},
		{
			name: "malformed commissioned_at is no baseline either",
			now:  testNow,
			task: monthsTask(6),
			equipment: models.Equipment{
				CommissionedAt: strPtr("15/01/2026"),
				CreatedAt:      at(2026, time.June, 1, 10, 0),
			},
			want: dueStatusWant{status: "overdue"},
		},
		{
			// The missing date baseline only affects the months rule: the hours
			// rule still reports its next due hours, and the task is overdue
			// because of the months rule.
			name: "both intervals, no date baseline: overdue, next due hours still given",
			now:  testNow,
			task: bothTask(6, 100),
			equipment: models.Equipment{
				TracksHours: true,
				Hours:       floatPtr(10),
				CreatedAt:   at(2026, time.June, 1, 10, 0),
			},
			want: dueStatusWant{status: "overdue", nextDueHours: floatPtr(100)},
		},
		{
			name:      "hours counted from zero",
			now:       testNow,
			task:      hoursTask(100),
			equipment: meter(95),
			want:      dueStatusWant{status: "due_soon", nextDueHours: floatPtr(100)},
		},
		{
			// Per spec: never performed means counted from 0, not from the
			// reading when the task was added.
			name:      "hours counted from zero even on a meter that already ran",
			now:       testNow,
			task:      hoursTask(100),
			equipment: meter(1200),
			want:      dueStatusWant{status: "overdue", nextDueHours: floatPtr(100)},
		},
		{
			name: "both intervals, hours drive",
			now:  testNow,
			task: bothTask(6, 100),
			equipment: models.Equipment{
				TracksHours:    true,
				Hours:          floatPtr(150),
				CommissionedAt: strPtr("2026-05-01"),
				CreatedAt:      at(2026, time.June, 1, 10, 0),
			},
			want: dueStatusWant{status: "overdue", nextDueDate: "2026-11-01", nextDueHours: floatPtr(100)},
		},
	})
}

// The last intervention has a date but no hour reading.
func TestComputeDueStatusInterventionWithoutHourReading(t *testing.T) {
	runDueStatusCases(t, []dueStatusCase{
		{
			name:      "months counted from its date",
			now:       testNow,
			task:      monthsTask(6),
			equipment: noMeter(),
			last:      done(midnight(2026, time.March, 1)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-09-01"},
		},
		{
			// Current behaviour: the hours baseline falls back to 0, as if the
			// task had never been performed. The spec only defines 0 for "never
			// performed". On a meter past the interval the task shows overdue
			// right after being done.
			name:      "hours counted from zero",
			now:       testNow,
			task:      hoursTask(100),
			equipment: meter(1200),
			last:      done(midnight(2026, time.June, 1)),
			want:      dueStatusWant{status: "overdue", nextDueHours: floatPtr(100)},
		},
		{
			// Current behaviour: same as above, the months rule is ok but the
			// zero hours baseline makes the task overdue.
			name:      "both intervals, hours counted from zero",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(1200),
			last:      done(midnight(2026, time.June, 1)),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-12-01", nextDueHours: floatPtr(100)},
		},
	})
}

// The hours rule only applies when the equipment tracks hours, whatever the
// task and the readings say.
func TestComputeDueStatusEquipmentNotTrackingHours(t *testing.T) {
	notTracking := models.Equipment{TracksHours: false, Hours: floatPtr(9000), CreatedAt: equipmentCreatedAt}

	runDueStatusCases(t, []dueStatusCase{
		{
			name:      "hours-only task has nothing due",
			now:       testNow,
			task:      hoursTask(100),
			equipment: notTracking,
			last:      doneAt(midnight(2026, time.March, 1), 0),
			want:      dueStatusWant{status: "ok"},
		},
		{
			name:      "both intervals, only months counts (ok)",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: notTracking,
			last:      doneAt(midnight(2026, time.March, 1), 0),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-09-01"},
		},
		{
			name:      "both intervals, only months counts (overdue)",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: notTracking,
			last:      doneAt(midnight(2025, time.November, 1), 0),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-05-01"},
		},
		{
			// The API rejects a task without any interval; pinned anyway.
			name:      "task without any interval has nothing due",
			now:       testNow,
			task:      models.Task{},
			equipment: notTracking,
			last:      done(midnight(2016, time.January, 1)),
			want:      dueStatusWant{status: "ok"},
		},
	})
}

// Exact instants around the months rule. Baseline 2026-01-15 00:00 UTC, every
// 6 months: due 2026-07-15 00:00 UTC, due-soon window opens 30 x 24 h before,
// at 2026-06-15 00:00 UTC.
func TestComputeDueStatusMonthsBoundaries(t *testing.T) {
	task := monthsTask(6)
	last := done(midnight(2026, time.January, 15))
	due := midnight(2026, time.July, 15)
	windowOpens := midnight(2026, time.June, 15)

	runDueStatusCases(t, []dueStatusCase{
		{
			name:      "just before the due-soon window",
			now:       windowOpens.Add(-time.Nanosecond),
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-07-15"},
		},
		{
			name:      "exactly when the due-soon window opens",
			now:       windowOpens,
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-07-15"},
		},
		{
			name:      "just inside the due-soon window",
			now:       windowOpens.Add(time.Nanosecond),
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-07-15"},
		},
		{
			// Current behaviour: reaching the due instant is not overdue yet
			// (the date has to be exceeded), whereas reaching the due reading
			// is overdue for the hours rule.
			name:      "exactly at the due instant",
			now:       due,
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-07-15"},
		},
		{
			name:      "just past the due instant",
			now:       due.Add(time.Nanosecond),
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-07-15"},
		},
		{
			// Current behaviour: the task is overdue for (almost) all of the
			// day shown as its next due date, not from the day after.
			name:      "midday on the next due date",
			now:       at(2026, time.July, 15, 12, 0),
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-07-15"},
		},
		{
			// Same instant as "exactly at the due instant", read in UTC+14:
			// only the instant matters, not the location of now.
			name:      "now in another location",
			now:       due.In(time.FixedZone("UTC+14", 14*60*60)),
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-07-15"},
		},
		{
			// The margin is 30 days, not one month: due 2026-08-10, so the
			// window opens 2026-07-11, and 2026-07-10 is still ok.
			name:      "margin is 30 days, not one month",
			now:       at(2026, time.July, 10, 12, 0),
			task:      task,
			equipment: noMeter(),
			last:      done(midnight(2026, time.February, 10)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-08-10"},
		},
		{
			// Current behaviour: a 1-month interval is at most 31 days, so the
			// 30-day window opens within a day of the task being done. After
			// a February baseline (28 days) it is due soon straight away.
			name:      "1-month task due soon right after being done in February",
			now:       at(2026, time.February, 1, 12, 0),
			task:      monthsTask(1),
			equipment: noMeter(),
			last:      done(midnight(2026, time.February, 1)),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-03-01"},
		},
		{
			name:      "1-month task ok on the day it is done in a 31-day month",
			now:       at(2026, time.January, 1, 12, 0),
			task:      monthsTask(1),
			equipment: noMeter(),
			last:      done(midnight(2026, time.January, 1)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-02-01"},
		},
		{
			name:      "1-month task due soon the day after it is done in a 31-day month",
			now:       at(2026, time.January, 2, 12, 0),
			task:      monthsTask(1),
			equipment: noMeter(),
			last:      done(midnight(2026, time.January, 1)),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-02-01"},
		},
		{
			// commissioned_at is a plain calendar date parsed as 00:00 UTC, like
			// an intervention logged from a browser in UTC, so the task turns
			// overdue just after 00:00 UTC on its due date.
			name:      "commissioned_at baseline, just before the due instant",
			now:       due.Add(-time.Nanosecond),
			task:      task,
			equipment: models.Equipment{CommissionedAt: strPtr("2026-01-15"), CreatedAt: equipmentCreatedAt},
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-07-15"},
		},
		{
			name:      "commissioned_at baseline, just after the due instant",
			now:       due.Add(time.Nanosecond),
			task:      task,
			equipment: models.Equipment{CommissionedAt: strPtr("2026-01-15"), CreatedAt: equipmentCreatedAt},
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-07-15"},
		},
		{
			// Current behaviour: an intervention dated 2026-01-15 by a browser
			// in UTC+2 is stored as 2026-01-14 22:00 UTC, and the next due date
			// is formatted in UTC, one day earlier than the user's calendar
			// date (2026-07-15). Plain calendar dates are issue #72.
			name:      "intervention logged at local midnight east of UTC",
			now:       testNow,
			task:      task,
			equipment: noMeter(),
			last:      done(at(2026, time.January, 14, 22, 0)),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-07-14"},
		},
	})
}

// Month arithmetic uses time.AddDate, which normalises an overflowing day
// into the next month instead of clamping it to the month end.
func TestComputeDueStatusMonthEndArithmetic(t *testing.T) {
	runDueStatusCases(t, []dueStatusCase{
		{
			// Current behaviour: Jan 31 + 1 month is "Feb 31", normalised to
			// Mar 3. Clamped to Feb 28 it would already be overdue on Mar 1.
			name:      "Jan 31 + 1 month is Mar 3",
			now:       at(2026, time.March, 1, 12, 0),
			task:      monthsTask(1),
			equipment: noMeter(),
			last:      done(midnight(2026, time.January, 31)),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-03-03"},
		},
		{
			name:      "Jan 31 + 1 month in a leap year is Mar 2",
			now:       at(2028, time.March, 1, 12, 0),
			task:      monthsTask(1),
			equipment: noMeter(),
			last:      done(midnight(2028, time.January, 31)),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2028-03-02"},
		},
		{
			name:      "Aug 31 + 6 months is Mar 3",
			now:       at(2026, time.March, 2, 12, 0),
			task:      monthsTask(6),
			equipment: noMeter(),
			last:      done(midnight(2025, time.August, 31)),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-03-03"},
		},
		{
			name:      "Mar 31 + 6 months is Oct 1",
			now:       testNow,
			task:      monthsTask(6),
			equipment: noMeter(),
			last:      done(midnight(2026, time.March, 31)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-10-01"},
		},
		{
			name:      "Feb 29 + 12 months is Mar 1",
			now:       at(2028, time.June, 1, 0, 0),
			task:      monthsTask(12),
			equipment: noMeter(),
			last:      done(midnight(2028, time.February, 29)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2029-03-01"},
		},
		{
			name:      "Jan 31 + 12 months is Jan 31",
			now:       testNow,
			task:      monthsTask(12),
			equipment: noMeter(),
			last:      done(midnight(2026, time.January, 31)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2027-01-31"},
		},
		{
			// The last day of February maps to the 28th, not to the month end.
			name:      "Feb 28 + 6 months is Aug 28",
			now:       testNow,
			task:      monthsTask(6),
			equipment: noMeter(),
			last:      done(midnight(2026, time.February, 28)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-08-28"},
		},
	})
}

// Exact readings around the hours rule. Last done at 500 h, every 100 h: due
// at 600 h, due-soon margin opens 10 h before, at 590 h.
func TestComputeDueStatusHoursBoundaries(t *testing.T) {
	task := hoursTask(100)
	last := doneAt(midnight(2026, time.March, 1), 500)

	runDueStatusCases(t, []dueStatusCase{
		{
			name:      "just below the due-soon margin",
			now:       testNow,
			task:      task,
			equipment: meter(589.99),
			last:      last,
			want:      dueStatusWant{status: "ok", nextDueHours: floatPtr(600)},
		},
		{
			name:      "exactly at the due-soon margin",
			now:       testNow,
			task:      task,
			equipment: meter(590),
			last:      last,
			want:      dueStatusWant{status: "due_soon", nextDueHours: floatPtr(600)},
		},
		{
			name:      "just below the due reading",
			now:       testNow,
			task:      task,
			equipment: meter(599.99),
			last:      last,
			want:      dueStatusWant{status: "due_soon", nextDueHours: floatPtr(600)},
		},
		{
			// Reaching the due reading is overdue (compare "exactly at the due
			// instant" for the months rule, which is only due soon).
			name:      "exactly at the due reading",
			now:       testNow,
			task:      task,
			equipment: meter(600),
			last:      last,
			want:      dueStatusWant{status: "overdue", nextDueHours: floatPtr(600)},
		},
		{
			name:      "just past the due reading",
			now:       testNow,
			task:      task,
			equipment: meter(600.01),
			last:      last,
			want:      dueStatusWant{status: "overdue", nextDueHours: floatPtr(600)},
		},
		{
			// Current behaviour: the margin is a fixed 10 h whatever the
			// interval, so an interval of 10 h or less is due soon as soon as
			// it is done.
			name:      "10 h interval is due soon right after being done",
			now:       testNow,
			task:      hoursTask(10),
			equipment: meter(500),
			last:      last,
			want:      dueStatusWant{status: "due_soon", nextDueHours: floatPtr(510)},
		},
		{
			name:      "11 h interval is ok right after being done",
			now:       testNow,
			task:      hoursTask(11),
			equipment: meter(500),
			last:      last,
			want:      dueStatusWant{status: "ok", nextDueHours: floatPtr(511)},
		},
	})
}
