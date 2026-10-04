package logic

import (
	"fmt"
	"testing"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

// Ranking tests: clients order tasks by due status, then urgency, then name
// and id (doc/data-model.md, "Ranking tasks by urgency"). These cases compute
// two tasks' Due status at a pinned instant and check which one ranks first,
// across triggers, so the urgency values give the order the spec asks for.

// rankOrder is the spec's order up to the name and id tie-break: negative when
// a ranks first, positive when b does, 0 when name and id must decide.
func rankOrder(a, b DueStatus) int {
	if ra, rb := statusRank(a.Status), statusRank(b.Status); ra != rb {
		return rb - ra
	}
	switch {
	case a.Urgency == nil && b.Urgency == nil:
		return 0
	case b.Urgency == nil:
		return -1
	case a.Urgency == nil:
		return 1
	case *a.Urgency > *b.Urgency:
		return -1
	case *a.Urgency < *b.Urgency:
		return 1
	}
	return 0
}

type rankedTask struct {
	task      models.Task
	equipment models.Equipment
	last      *models.Intervention
}

type rankCase struct {
	name string
	now  time.Time
	// first ranks before second, or ties with it when tie is set.
	first, second rankedTask
	tie           bool
}

func TestUrgencyRanksTasks(t *testing.T) {
	// The #68 equipment: 300 h on the meter, in service since 2025-05-15
	// (13 months before testNow), nothing ever performed.
	issue68 := models.Equipment{
		TracksHours:    true,
		Hours:          floatPtr(300),
		CommissionedAt: strPtr("2025-05-15"),
		CreatedAt:      equipmentCreatedAt,
	}

	cases := []rankCase{
		{
			// Issue #68: the hours task's calendar due date is 11 months
			// ahead, yet it is overdue by 200 h, three times its interval.
			// The months task is a month past a 12-month interval.
			name:   "overdue by hours with a future calendar date ranks above overdue by months",
			now:    testNow,
			first:  rankedTask{task: bothTask(24, 100), equipment: issue68},
			second: rankedTask{task: monthsTask(12), equipment: issue68},
		},
		{
			// Issue #68: 200 h past due is less clock time than a month, but
			// three intervals against a twelfth of one.
			name:   "hours past due are not compared as clock hours",
			now:    testNow,
			first:  rankedTask{task: hoursTask(100), equipment: issue68},
			second: rankedTask{task: monthsTask(12), equipment: issue68},
		},
		{
			// 31 days past a 30-day (1-month) interval (61/30) against 800 h
			// past a 1000 h one (1.8). 800 h is more clock time than 31 days,
			// but a smaller share of the interval.
			name:   "overdue by months ranks above overdue by hours when further past",
			now:    testNow,
			first:  rankedTask{task: monthsTask(1), equipment: noMeter(), last: done(midnight(2026, time.April, 15))},
			second: rankedTask{task: hoursTask(1000), equipment: meter(2300), last: doneAt(midnight(2026, time.June, 1), 500)},
		},
		{
			// Due soon, both: 5 h left of 100 h (0.95) against 10 days left
			// of 182 (0.945).
			name:   "due soon by hours ranks above due soon by months when further through",
			now:    testNow,
			first:  rankedTask{task: hoursTask(100), equipment: meter(595), last: doneAt(midnight(2026, time.March, 1), 500)},
			second: rankedTask{task: monthsTask(6), equipment: noMeter(), last: done(midnight(2025, time.December, 25))},
		},
		{
			// Both at 1 at the exact due instant: the months rule is only
			// due soon there (#77), the hours rule overdue. Status first.
			name:   "overdue ranks above due soon at the same fraction",
			now:    midnight(2026, time.July, 15),
			first:  rankedTask{task: hoursTask(100), equipment: meter(600), last: doneAt(midnight(2026, time.March, 1), 500)},
			second: rankedTask{task: monthsTask(6), equipment: noMeter(), last: done(midnight(2026, time.January, 15))},
		},
		{
			// 8 h left of 100 h (0.92, due soon) against 35 days left of a
			// 10-year interval (0.99, ok). Status first.
			name:   "due soon ranks above ok with a greater fraction",
			now:    testNow,
			first:  rankedTask{task: hoursTask(100), equipment: meter(592), last: doneAt(midnight(2026, time.March, 1), 500)},
			second: rankedTask{task: monthsTask(120), equipment: noMeter(), last: done(midnight(2016, time.July, 20))},
		},
		{
			// No reading on the meter: the hours rule does not apply, the
			// task is ok without an urgency, and comes after one that has.
			name:   "a task without urgency ranks after an ok one with urgency",
			now:    testNow,
			first:  rankedTask{task: monthsTask(6), equipment: noMeter(), last: done(midnight(2026, time.March, 1))},
			second: rankedTask{task: hoursTask(100), equipment: models.Equipment{TracksHours: true, CreatedAt: equipmentCreatedAt}, last: doneAt(midnight(2026, time.March, 1), 500)},
		},
		{
			// Never performed: counted from commissioned_at (months) and
			// from 0 (hours). 14 days past a 182-day interval (1.077)
			// against 105 h on a 100 h interval (1.05).
			name:   "no intervention yet, ranked from the baselines",
			now:    testNow,
			first:  rankedTask{task: monthsTask(6), equipment: models.Equipment{CommissionedAt: strPtr("2025-12-01"), CreatedAt: equipmentCreatedAt}},
			second: rankedTask{task: hoursTask(100), equipment: meter(105)},
		},
		{
			// Half-way through both: 92 of 184 days and 50 of 100 h. The
			// name and id decide.
			name:   "equal fractions across triggers tie",
			now:    at(2026, time.June, 1, 12, 0),
			first:  rankedTask{task: monthsTask(6), equipment: noMeter(), last: done(midnight(2026, time.March, 1))},
			second: rankedTask{task: hoursTask(100), equipment: meter(550), last: doneAt(midnight(2026, time.March, 1), 500)},
			tie:    true,
		},
		{
			// Two tasks just done, both at 0.
			name:   "just done, both at zero, tie",
			now:    testNow,
			first:  rankedTask{task: monthsTask(6), equipment: noMeter(), last: done(midnight(2026, time.June, 15))},
			second: rankedTask{task: hoursTask(100), equipment: meter(500), last: doneAt(midnight(2026, time.June, 15), 500)},
			tie:    true,
		},
		{
			// The day after the due date ranks above the due date itself:
			// 182/181 against 181/181, both overdue.
			name:   "a day further past the due date ranks first",
			now:    at(2026, time.July, 16, 12, 0),
			first:  rankedTask{task: monthsTask(6), equipment: noMeter(), last: done(midnight(2026, time.January, 15))},
			second: rankedTask{task: monthsTask(6), equipment: noMeter(), last: done(midnight(2026, time.January, 16))},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := ComputeDueStatus(tc.first.task, tc.first.equipment, tc.first.last, tc.now)
			b := ComputeDueStatus(tc.second.task, tc.second.equipment, tc.second.last, tc.now)

			want := -1
			if tc.tie {
				want = 0
			}
			if got := rankOrder(a, b); got != want {
				t.Errorf("rankOrder(first, second) = %d, want %d\nfirst:  %s\nsecond: %s", got, want, describe(a), describe(b))
			}
			if got := rankOrder(b, a); got != -want {
				t.Errorf("rankOrder(second, first) = %d, want %d", got, -want)
			}
		})
	}
}

func describe(d DueStatus) string {
	if d.Urgency == nil {
		return fmt.Sprintf("%s via %q, urgency nil", d.Status, d.Trigger)
	}
	return fmt.Sprintf("%s via %q, urgency %.4f", d.Status, d.Trigger, *d.Urgency)
}
