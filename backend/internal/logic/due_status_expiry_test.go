package logic

import (
	"math"
	"testing"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

// Issue #99: an expiry task is due on the expiry date of the part fitted
// (doc/data-model.md, "Expiry rule").

// expiryTask is an expiry task, with a current expiry date when current is
// not "".
func expiryTask(current string) models.Task {
	task := models.Task{Kind: models.KindExpiry}
	if current != "" {
		task.CurrentExpiryDate = strPtr(current)
	}
	return task
}

// fitted is an intervention on an expiry task: the part fitted on date
// expires on expiry.
func fitted(date time.Time, expiry string) *models.Intervention {
	return &models.Intervention{Date: date, ExpiryDate: strPtr(expiry)}
}

func TestComputeDueStatusExpiry(t *testing.T) {
	runDueStatusCases(t, []dueStatusCase{
		{
			// Fitted 2026-01-15, expires 2027-01-15: 151 of 365 days.
			name:      "due on the latest intervention's expiry date",
			now:       testNow,
			task:      expiryTask(""),
			equipment: noMeter(),
			last:      fitted(midnight(2026, time.January, 15), "2027-01-15"),
			want:      dueStatusWant{status: "ok", nextDueDate: "2027-01-15", trigger: TriggerExpiry, dueInDays: intPtr(214), urgency: frac(151, 365)},
		},
		{
			// The part fitted later replaced the one the task was created
			// with: its date no longer counts.
			name:      "the latest intervention's expiry date wins over the current expiry date",
			now:       testNow,
			task:      expiryTask("2026-06-20"),
			equipment: noMeter(),
			last:      fitted(midnight(2026, time.January, 15), "2027-01-15"),
			want:      dueStatusWant{status: "ok", nextDueDate: "2027-01-15", trigger: TriggerExpiry, dueInDays: intPtr(214), urgency: frac(151, 365)},
		},
		{
			// Several replacements: the latest by date counts, whatever the
			// order they come in.
			name:      "the latest of several interventions counts",
			now:       testNow,
			task:      expiryTask(""),
			equipment: noMeter(),
			last:      fitted(midnight(2026, time.January, 15), "2027-01-15"),
			earlier:   []*models.Intervention{fitted(midnight(2025, time.January, 10), "2026-01-10")},
			want:      dueStatusWant{status: "ok", nextDueDate: "2027-01-15", trigger: TriggerExpiry, dueInDays: intPtr(214), urgency: frac(151, 365)},
		},
		{
			// Nothing fitted yet: no date fitted to measure from, so no
			// urgency.
			name:      "before any intervention, due on the current expiry date",
			now:       testNow,
			task:      expiryTask("2027-01-15"),
			equipment: noMeter(),
			want:      dueStatusWant{status: "ok", nextDueDate: "2027-01-15", trigger: TriggerExpiry, dueInDays: intPtr(214)},
		},
		{
			name:      "no intervention and no current expiry date: overdue with no date",
			now:       testNow,
			task:      expiryTask(""),
			equipment: noMeter(),
			want:      dueStatusWant{status: "overdue", trigger: TriggerExpiry},
		},
		{
			// 10 days to go, inside the 30-day window. Fitted 2025-06-25:
			// 355 of 365 days.
			name:      "due soon within 30 days of the expiry date",
			now:       testNow,
			task:      expiryTask(""),
			equipment: noMeter(),
			last:      fitted(midnight(2025, time.June, 25), "2026-06-25"),
			want:      dueStatusWant{status: "due_soon", nextDueDate: "2026-06-25", trigger: TriggerExpiry, dueInDays: intPtr(10), urgency: frac(355, 365)},
		},
		{
			name:      "ok 31 days before the expiry date",
			now:       testNow,
			task:      expiryTask("2026-07-16"),
			equipment: noMeter(),
			want:      dueStatusWant{status: "ok", nextDueDate: "2026-07-16", trigger: TriggerExpiry, dueInDays: intPtr(31)},
		},
		{
			// The same instant comparison as the months rule's due date.
			name:      "overdue on the expiry date itself",
			now:       testNow,
			task:      expiryTask("2026-06-15"),
			equipment: noMeter(),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-06-15", trigger: TriggerExpiry, dueInDays: intPtr(0)},
		},
		{
			// Fitted 2025-06-01, expired 2026-05-01: 379 of 334 days.
			name:      "overdue past the expiry date",
			now:       testNow,
			task:      expiryTask(""),
			equipment: noMeter(),
			last:      fitted(midnight(2025, time.June, 1), "2026-05-01"),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-05-01", trigger: TriggerExpiry, dueInDays: intPtr(-45), urgency: frac(379, 334)},
		},
		{
			// An expiry task has no hours rule, even on an equipment that
			// tracks hours, and the reading recorded plays no part.
			name:      "the hour-meter plays no part",
			now:       testNow,
			task:      expiryTask(""),
			equipment: meter(5000),
			last:      &models.Intervention{Date: midnight(2026, time.January, 15), HoursAt: floatPtr(10), ExpiryDate: strPtr("2027-01-15")},
			want:      dueStatusWant{status: "ok", nextDueDate: "2027-01-15", trigger: TriggerExpiry, dueInDays: intPtr(214), urgency: frac(151, 365)},
		},
		{
			// Fitted 2026-06-01 already expired since 2026-05-01: no shelf
			// life to divide by. It ranks at the top of the overdue tasks.
			name:      "a part fitted already expired has the greatest urgency",
			now:       testNow,
			task:      expiryTask(""),
			equipment: noMeter(),
			last:      fitted(midnight(2026, time.June, 1), "2026-05-01"),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-05-01", trigger: TriggerExpiry, dueInDays: intPtr(-45), urgency: floatPtr(math.MaxFloat64)},
		},
		{
			name:      "a part fitted on its expiry date has the greatest urgency",
			now:       testNow,
			task:      expiryTask(""),
			equipment: noMeter(),
			last:      fitted(midnight(2026, time.June, 1), "2026-06-01"),
			want:      dueStatusWant{status: "overdue", nextDueDate: "2026-06-01", trigger: TriggerExpiry, dueInDays: intPtr(-14), urgency: floatPtr(math.MaxFloat64)},
		},
	})
}
