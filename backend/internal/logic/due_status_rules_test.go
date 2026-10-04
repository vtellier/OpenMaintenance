package logic

import (
	"math"
	"testing"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

// Fixed-clock tests for ComputeDueStatus: every rule of the due status
// (Overdue / Due soon / OK, next due date, next due hours, driving trigger,
// days and hours to go) checked at pinned instants instead of whenever the
// test happens to run.
//
// The cases pin the CURRENT behaviour. Where it is surprising, or the spec in
// doc/data-model.md does not say, the case carries a "Current behaviour:"
// comment. Those are findings, not changes: if one is changed, change the
// case on purpose.
//
// Extending: add a field to dueStatusWant, assert it in runDueStatusCases and
// fill it in the tables.

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

// utcMinus4 is a fixed location west of UTC (e.g. US Eastern summer time),
// for the cases where the user's timezone matters.
var utcMinus4 = time.FixedZone("UTC-4", -4*60*60)

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
	trigger      string   // "" when no rule applies
	dueInDays    *int     // nil when the months rule does not apply or has no baseline
	dueInHours   *float64 // nil when the hours rule does not apply
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

			got := ComputeDueStatus(tc.task, tc.equipment, tc.last, tc.now)

			if got.Status != tc.want.status {
				t.Errorf("status = %q, want %q", got.Status, tc.want.status)
			}
			if got.NextDueDate != tc.want.nextDueDate {
				t.Errorf("nextDueDate = %q, want %q", got.NextDueDate, tc.want.nextDueDate)
			}
			checkOptionalFloat(t, "nextDueHours", got.NextDueHours, tc.want.nextDueHours)
			if got.Trigger != tc.want.trigger {
				t.Errorf("trigger = %q, want %q", got.Trigger, tc.want.trigger)
			}
			switch {
			case tc.want.dueInDays == nil && got.DueInDays != nil:
				t.Errorf("dueInDays = %d, want nil", *got.DueInDays)
			case tc.want.dueInDays != nil && got.DueInDays == nil:
				t.Errorf("dueInDays = nil, want %d", *tc.want.dueInDays)
			case tc.want.dueInDays != nil && *got.DueInDays != *tc.want.dueInDays:
				t.Errorf("dueInDays = %d, want %d", *got.DueInDays, *tc.want.dueInDays)
			}
			checkOptionalFloat(t, "dueInHours", got.DueInHours, tc.want.dueInHours)
		})
	}
}

// checkOptionalFloat compares hour values with a tolerance: they come from
// float subtractions such as 600.5 - 600.4.
func checkOptionalFloat(t *testing.T, name string, got, want *float64) {
	t.Helper()
	switch {
	case want == nil && got != nil:
		t.Errorf("%s = %v, want nil", name, *got)
	case want != nil && got == nil:
		t.Errorf("%s = nil, want %v", name, *want)
	case want != nil && math.Abs(*got-*want) > 1e-9:
		t.Errorf("%s = %v, want %v", name, *got, *want)
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
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-09-01", trigger: TriggerMonths, dueInDays: intPtr(78)},
		},
		{
			name:      "due soon inside the 30-day window",
			now:       testNow,
			task:      monthsTask(6),
			equipment: noMeter(),
			last:      done(midnight(2025, time.December, 25)),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-06-25", trigger: TriggerMonths, dueInDays: intPtr(10)},
		},
		{
			name:      "overdue past the due date",
			now:       testNow,
			task:      monthsTask(6),
			equipment: noMeter(),
			last:      done(midnight(2025, time.November, 1)),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-05-01", trigger: TriggerMonths, dueInDays: intPtr(-45)},
		},
		{
			name:      "hour reading plays no part",
			now:       testNow,
			task:      monthsTask(6),
			equipment: meter(5000),
			last:      doneAt(midnight(2026, time.March, 1), 0),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-09-01", trigger: TriggerMonths, dueInDays: intPtr(78)},
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
			want:      dueStatusWant{status: "ok", nextDueHours: floatPtr(600), trigger: TriggerHours, dueInHours: floatPtr(80)},
		},
		{
			name:      "due soon inside the 10 h margin",
			now:       testNow,
			task:      hoursTask(100),
			equipment: meter(595),
			last:      doneAt(midnight(2026, time.March, 1), 500),
			want:      dueStatusWant{status: "due_soon", nextDueHours: floatPtr(600), trigger: TriggerHours, dueInHours: floatPtr(5)},
		},
		{
			name:      "overdue past the due reading",
			now:       testNow,
			task:      hoursTask(100),
			equipment: meter(650),
			last:      doneAt(midnight(2026, time.March, 1), 500),
			want:      dueStatusWant{status: "overdue", nextDueHours: floatPtr(600), trigger: TriggerHours, dueInHours: floatPtr(-50)},
		},
		{
			name:      "fractional readings",
			now:       testNow,
			task:      hoursTask(100),
			equipment: meter(600.4),
			last:      doneAt(midnight(2026, time.March, 1), 500.5),
			want:      dueStatusWant{status: "due_soon", nextDueHours: floatPtr(600.5), trigger: TriggerHours, dueInHours: floatPtr(0.1)},
		},
		{
			name:      "time elapsed plays no part",
			now:       testNow,
			task:      hoursTask(100),
			equipment: meter(520),
			last:      doneAt(midnight(2016, time.January, 1), 500),
			want:      dueStatusWant{status: "ok", nextDueHours: floatPtr(600), trigger: TriggerHours, dueInHours: floatPtr(80)},
		},
		{
			// No reading on the equipment yet: the next due reading is known,
			// but there is nothing to compare it with, so the hours rule does
			// not apply: no trigger and no hours to go.
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
// The rule with the worse status drives the task; months drives on a tie.
// Both amounts are returned whatever drives.
func TestComputeDueStatusBothIntervals(t *testing.T) {
	runDueStatusCases(t, []dueStatusCase{
		{
			name:      "both ok, months drive on a tie",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(520),
			last:      doneAt(midnight(2026, time.March, 1), 500),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-09-01", nextDueHours: floatPtr(600), trigger: TriggerMonths, dueInDays: intPtr(78), dueInHours: floatPtr(80)},
		},
		{
			name:      "months due soon, hours ok",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(520),
			last:      doneAt(midnight(2025, time.December, 25), 500),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-06-25", nextDueHours: floatPtr(600), trigger: TriggerMonths, dueInDays: intPtr(10), dueInHours: floatPtr(80)},
		},
		{
			name:      "hours due soon, months ok",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(595),
			last:      doneAt(midnight(2026, time.March, 1), 500),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-09-01", nextDueHours: floatPtr(600), trigger: TriggerHours, dueInDays: intPtr(78), dueInHours: floatPtr(5)},
		},
		{
			name:      "months overdue, hours ok",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(520),
			last:      doneAt(midnight(2025, time.November, 1), 500),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-05-01", nextDueHours: floatPtr(600), trigger: TriggerMonths, dueInDays: intPtr(-45), dueInHours: floatPtr(80)},
		},
		{
			// The next due date is still in the future: the date alone does
			// not tell which trigger drives the status (see #52, #67). The
			// trigger does.
			name:      "hours overdue, months ok",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(650),
			last:      doneAt(midnight(2026, time.March, 1), 500),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-09-01", nextDueHours: floatPtr(600), trigger: TriggerHours, dueInDays: intPtr(78), dueInHours: floatPtr(-50)},
		},
		{
			name:      "months overdue, hours due soon",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(595),
			last:      doneAt(midnight(2025, time.November, 1), 500),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-05-01", nextDueHours: floatPtr(600), trigger: TriggerMonths, dueInDays: intPtr(-45), dueInHours: floatPtr(5)},
		},
		{
			name:      "months due soon, hours overdue",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(650),
			last:      doneAt(midnight(2025, time.December, 25), 500),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-06-25", nextDueHours: floatPtr(600), trigger: TriggerHours, dueInDays: intPtr(10), dueInHours: floatPtr(-50)},
		},
		{
			name:      "both due soon, months drive on a tie",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(595),
			last:      doneAt(midnight(2025, time.December, 25), 500),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-06-25", nextDueHours: floatPtr(600), trigger: TriggerMonths, dueInDays: intPtr(10), dueInHours: floatPtr(5)},
		},
		{
			name:      "both overdue, months drive on a tie",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(650),
			last:      doneAt(midnight(2025, time.November, 1), 500),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-05-01", nextDueHours: floatPtr(600), trigger: TriggerMonths, dueInDays: intPtr(-45), dueInHours: floatPtr(-50)},
		},
		{
			// Without a reading the hours rule does not apply, so months drive
			// even though it is only ok.
			name:      "no current reading, months drive alone",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: models.Equipment{TracksHours: true, CreatedAt: equipmentCreatedAt},
			last:      doneAt(midnight(2026, time.March, 1), 500),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-09-01", nextDueHours: floatPtr(600), trigger: TriggerMonths, dueInDays: intPtr(78)},
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
			want: dueStatusWant{status: "overdue", nextDueDate: "2026-06-01", trigger: TriggerMonths, dueInDays: intPtr(-14)},
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
			want: dueStatusWant{status: "overdue", trigger: TriggerMonths},
		},
		{
			name: "malformed commissioned_at is no baseline either",
			now:  testNow,
			task: monthsTask(6),
			equipment: models.Equipment{
				CommissionedAt: strPtr("15/01/2026"),
				CreatedAt:      at(2026, time.June, 1, 10, 0),
			},
			want: dueStatusWant{status: "overdue", trigger: TriggerMonths},
		},
		{
			// The missing date baseline only affects the months rule: the hours
			// rule still reports its next due hours and its amount, and the
			// task is overdue because of the months rule (the hours rule is ok).
			name: "both intervals, no date baseline, hours ok: months drives, overdue, no amount",
			now:  testNow,
			task: bothTask(6, 100),
			equipment: models.Equipment{
				TracksHours: true,
				Hours:       floatPtr(10),
				CreatedAt:   at(2026, time.June, 1, 10, 0),
			},
			want: dueStatusWant{status: "overdue", nextDueHours: floatPtr(100), trigger: TriggerMonths, dueInHours: floatPtr(90)},
		},
		{
			// An overdue hours rule has a concrete amount, so it drives rather
			// than the months rule that is overdue with nothing to count.
			name: "both intervals, no date baseline, hours overdue: hours drives",
			now:  testNow,
			task: bothTask(6, 100),
			equipment: models.Equipment{
				TracksHours: true,
				Hours:       floatPtr(130),
				CreatedAt:   at(2026, time.June, 1, 10, 0),
			},
			want: dueStatusWant{status: "overdue", nextDueHours: floatPtr(100), trigger: TriggerHours, dueInHours: floatPtr(-30)},
		},
		{
			// Hours only due soon is a better status than the months overdue.
			name: "both intervals, no date baseline, hours due soon: months drives",
			now:  testNow,
			task: bothTask(6, 100),
			equipment: models.Equipment{
				TracksHours: true,
				Hours:       floatPtr(95),
				CreatedAt:   at(2026, time.June, 1, 10, 0),
			},
			want: dueStatusWant{status: "overdue", nextDueHours: floatPtr(100), trigger: TriggerMonths, dueInHours: floatPtr(5)},
		},
		{
			// The hours rule has no reading to compare, so it has no status:
			// the months rule is the only one that applies.
			name: "both intervals, no date baseline, no hours reading: months drives",
			now:  testNow,
			task: bothTask(6, 100),
			equipment: models.Equipment{
				TracksHours: true,
				CreatedAt:   at(2026, time.June, 1, 10, 0),
			},
			want: dueStatusWant{status: "overdue", nextDueHours: floatPtr(100), trigger: TriggerMonths},
		},
		{
			name:      "hours counted from zero",
			now:       testNow,
			task:      hoursTask(100),
			equipment: meter(95),
			want:      dueStatusWant{status: "due_soon", nextDueHours: floatPtr(100), trigger: TriggerHours, dueInHours: floatPtr(5)},
		},
		{
			// Per spec: never performed means counted from 0, not from the
			// reading when the task was added.
			name:      "hours counted from zero even on a meter that already ran",
			now:       testNow,
			task:      hoursTask(100),
			equipment: meter(1200),
			want:      dueStatusWant{status: "overdue", nextDueHours: floatPtr(100), trigger: TriggerHours, dueInHours: floatPtr(-1100)},
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
			want: dueStatusWant{status: "overdue", nextDueDate: "2026-11-01", nextDueHours: floatPtr(100), trigger: TriggerHours, dueInDays: intPtr(139), dueInHours: floatPtr(-50)},
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
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-09-01", trigger: TriggerMonths, dueInDays: intPtr(78)},
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
			want:      dueStatusWant{status: "overdue", nextDueHours: floatPtr(100), trigger: TriggerHours, dueInHours: floatPtr(-1100)},
		},
		{
			// Current behaviour: same as above, the months rule is ok but the
			// zero hours baseline makes the task overdue.
			name:      "both intervals, hours counted from zero",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: meter(1200),
			last:      done(midnight(2026, time.June, 1)),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-12-01", nextDueHours: floatPtr(100), trigger: TriggerHours, dueInDays: intPtr(169), dueInHours: floatPtr(-1100)},
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
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-09-01", trigger: TriggerMonths, dueInDays: intPtr(78)},
		},
		{
			name:      "both intervals, only months counts (overdue)",
			now:       testNow,
			task:      bothTask(6, 100),
			equipment: notTracking,
			last:      doneAt(midnight(2025, time.November, 1), 0),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-05-01", trigger: TriggerMonths, dueInDays: intPtr(-45)},
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
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(31)},
		},
		{
			name:      "exactly when the due-soon window opens",
			now:       windowOpens,
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(30)},
		},
		{
			name:      "just inside the due-soon window",
			now:       windowOpens.Add(time.Nanosecond),
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(30)},
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
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(0)},
		},
		{
			name:      "just past the due instant",
			now:       due.Add(time.Nanosecond),
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(0)},
		},
		{
			// Current behaviour: the task is overdue for (almost) all of the
			// day shown as its next due date, not from the day after.
			name:      "midday on the next due date",
			now:       at(2026, time.July, 15, 12, 0),
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(0)},
		},
		{
			// Same instant as "exactly at the due instant", read in UTC+14:
			// only the instant matters, not the location of now.
			name:      "now in another location",
			now:       due.In(time.FixedZone("UTC+14", 14*60*60)),
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(0)},
		},
		{
			// The margin is 30 days, not one month: due 2026-08-10, so the
			// window opens 2026-07-11, and 2026-07-10 is still ok.
			name:      "margin is 30 days, not one month",
			now:       at(2026, time.July, 10, 12, 0),
			task:      task,
			equipment: noMeter(),
			last:      done(midnight(2026, time.February, 10)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-08-10", trigger: TriggerMonths, dueInDays: intPtr(31)},
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
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-03-01", trigger: TriggerMonths, dueInDays: intPtr(28)},
		},
		{
			name:      "1-month task ok on the day it is done in a 31-day month",
			now:       at(2026, time.January, 1, 12, 0),
			task:      monthsTask(1),
			equipment: noMeter(),
			last:      done(midnight(2026, time.January, 1)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-02-01", trigger: TriggerMonths, dueInDays: intPtr(31)},
		},
		{
			name:      "1-month task due soon the day after it is done in a 31-day month",
			now:       at(2026, time.January, 2, 12, 0),
			task:      monthsTask(1),
			equipment: noMeter(),
			last:      done(midnight(2026, time.January, 1)),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-02-01", trigger: TriggerMonths, dueInDays: intPtr(30)},
		},
		{
			// commissioned_at is a plain calendar date parsed as 00:00 UTC, like
			// an intervention logged from a browser in UTC, so the task turns
			// overdue just after 00:00 UTC on its due date.
			name:      "commissioned_at baseline, just before the due instant",
			now:       due.Add(-time.Nanosecond),
			task:      task,
			equipment: models.Equipment{CommissionedAt: strPtr("2026-01-15"), CreatedAt: equipmentCreatedAt},
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(1)},
		},
		{
			name:      "commissioned_at baseline, just after the due instant",
			now:       due.Add(time.Nanosecond),
			task:      task,
			equipment: models.Equipment{CommissionedAt: strPtr("2026-01-15"), CreatedAt: equipmentCreatedAt},
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(0)},
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
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-07-14", trigger: TriggerMonths, dueInDays: intPtr(29)},
		},
		{
			// Current behaviour: commissioned_at is parsed as 00:00 UTC, so
			// for a user in UTC-4 the task turns overdue at 20:00 local time
			// the evening before the date shown as next due. The days are
			// counted on the UTC calendar too: 0, although it is still the
			// 14th for that user.
			name: "commissioned_at baseline, evening before the due date in UTC-4",
			now:  time.Date(2026, time.July, 14, 20, 30, 0, 0, utcMinus4),
			task: task,
			equipment: models.Equipment{
				CommissionedAt: strPtr("2026-01-15"),
				CreatedAt:      equipmentCreatedAt,
			},
			want: dueStatusWant{status: "overdue", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(0)},
		},
		{
			// Contrast: the same calendar date logged as an intervention from
			// a UTC-4 browser is stored as 04:00 UTC (local midnight), so on
			// that same evening the task is still only due soon.
			name:      "intervention baseline, evening before the due date in UTC-4",
			now:       time.Date(2026, time.July, 14, 20, 30, 0, 0, utcMinus4),
			task:      task,
			equipment: noMeter(),
			last:      done(time.Date(2026, time.January, 15, 0, 0, 0, 0, utcMinus4).UTC()),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(0)},
		},
	})
}

// Days to go count calendar dates, not 24-hour periods: the next due date
// minus today's date, both read in the location the next due date is
// formatted in (UTC from the database). Due 2026-07-15 00:00 UTC.
func TestComputeDueStatusDaysAreCalendarDays(t *testing.T) {
	task := monthsTask(6)
	last := done(midnight(2026, time.January, 15))

	runDueStatusCases(t, []dueStatusCase{
		{
			name:      "first instant of the day before",
			now:       midnight(2026, time.July, 14),
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(1)},
		},
		{
			name:      "last instant of the day before",
			now:       midnight(2026, time.July, 15).Add(-time.Nanosecond),
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(1)},
		},
		{
			name:      "last instant of the due date",
			now:       midnight(2026, time.July, 16).Add(-time.Nanosecond),
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(0)},
		},
		{
			name:      "first instant of the day after",
			now:       midnight(2026, time.July, 16),
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(-1)},
		},
		{
			// Same instant as "first instant of the day after", read in UTC-4,
			// where it is still the 15th. The days follow the UTC date of the
			// next due date, not now's location.
			name:      "now in a location west of UTC",
			now:       midnight(2026, time.July, 16).In(utcMinus4),
			task:      task,
			equipment: noMeter(),
			last:      last,
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-07-15", trigger: TriggerMonths, dueInDays: intPtr(-1)},
		},
		{
			name:      "a year ahead across a leap day",
			now:       at(2027, time.March, 1, 12, 0),
			task:      monthsTask(12),
			equipment: noMeter(),
			last:      done(midnight(2027, time.March, 1)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2028-03-01", trigger: TriggerMonths, dueInDays: intPtr(366)},
		},
		{
			name:      "years past",
			now:       testNow,
			task:      task,
			equipment: noMeter(),
			last:      done(midnight(2016, time.June, 15)),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2016-12-15", trigger: TriggerMonths, dueInDays: intPtr(-3469)},
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
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-03-03", trigger: TriggerMonths, dueInDays: intPtr(2)},
		},
		{
			name:      "Jan 31 + 1 month in a leap year is Mar 2",
			now:       at(2028, time.March, 1, 12, 0),
			task:      monthsTask(1),
			equipment: noMeter(),
			last:      done(midnight(2028, time.January, 31)),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2028-03-02", trigger: TriggerMonths, dueInDays: intPtr(1)},
		},
		{
			name:      "Aug 31 + 6 months is Mar 3",
			now:       at(2026, time.March, 2, 12, 0),
			task:      monthsTask(6),
			equipment: noMeter(),
			last:      done(midnight(2025, time.August, 31)),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-03-03", trigger: TriggerMonths, dueInDays: intPtr(1)},
		},
		{
			name:      "Mar 31 + 6 months is Oct 1",
			now:       testNow,
			task:      monthsTask(6),
			equipment: noMeter(),
			last:      done(midnight(2026, time.March, 31)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-10-01", trigger: TriggerMonths, dueInDays: intPtr(108)},
		},
		{
			name:      "Feb 29 + 12 months is Mar 1",
			now:       at(2028, time.June, 1, 0, 0),
			task:      monthsTask(12),
			equipment: noMeter(),
			last:      done(midnight(2028, time.February, 29)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2029-03-01", trigger: TriggerMonths, dueInDays: intPtr(273)},
		},
		{
			name:      "Jan 31 + 12 months is Jan 31",
			now:       testNow,
			task:      monthsTask(12),
			equipment: noMeter(),
			last:      done(midnight(2026, time.January, 31)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2027-01-31", trigger: TriggerMonths, dueInDays: intPtr(230)},
		},
		{
			// The last day of February maps to the 28th, not to the month end.
			name:      "Feb 28 + 6 months is Aug 28",
			now:       testNow,
			task:      monthsTask(6),
			equipment: noMeter(),
			last:      done(midnight(2026, time.February, 28)),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-08-28", trigger: TriggerMonths, dueInDays: intPtr(74)},
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
			want:      dueStatusWant{status: "ok", nextDueHours: floatPtr(600), trigger: TriggerHours, dueInHours: floatPtr(10.01)},
		},
		{
			name:      "exactly at the due-soon margin",
			now:       testNow,
			task:      task,
			equipment: meter(590),
			last:      last,
			want:      dueStatusWant{status: "due_soon", nextDueHours: floatPtr(600), trigger: TriggerHours, dueInHours: floatPtr(10)},
		},
		{
			name:      "just below the due reading",
			now:       testNow,
			task:      task,
			equipment: meter(599.99),
			last:      last,
			want:      dueStatusWant{status: "due_soon", nextDueHours: floatPtr(600), trigger: TriggerHours, dueInHours: floatPtr(0.01)},
		},
		{
			// Reaching the due reading is overdue (compare "exactly at the due
			// instant" for the months rule, which is only due soon). Hours to
			// go are 0, the sign of an overdue amount being <= 0.
			name:      "exactly at the due reading",
			now:       testNow,
			task:      task,
			equipment: meter(600),
			last:      last,
			want:      dueStatusWant{status: "overdue", nextDueHours: floatPtr(600), trigger: TriggerHours, dueInHours: floatPtr(0)},
		},
		{
			name:      "just past the due reading",
			now:       testNow,
			task:      task,
			equipment: meter(600.01),
			last:      last,
			want:      dueStatusWant{status: "overdue", nextDueHours: floatPtr(600), trigger: TriggerHours, dueInHours: floatPtr(-0.01)},
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
			want:      dueStatusWant{status: "due_soon", nextDueHours: floatPtr(510), trigger: TriggerHours, dueInHours: floatPtr(10)},
		},
		{
			name:      "11 h interval is ok right after being done",
			now:       testNow,
			task:      hoursTask(11),
			equipment: meter(500),
			last:      last,
			want:      dueStatusWant{status: "ok", nextDueHours: floatPtr(511), trigger: TriggerHours, dueInHours: floatPtr(11)},
		},
	})
}
