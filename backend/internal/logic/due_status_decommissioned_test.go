package logic

import (
	"testing"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

// Issue #113: a task of a decommissioned equipment is never due. It has none
// of the computed fields, whatever its kind and history (doc/data-model.md,
// "Decommissioned equipment: never due").

// decommissioned returns the equipment, decommissioned on date.
func decommissioned(equipment models.Equipment, date string) models.Equipment {
	equipment.DecommissionedAt = strPtr(date)
	return equipment
}

func TestComputeDueStatusDecommissionedEquipment(t *testing.T) {
	runDueStatusCases(t, []dueStatusCase{
		{
			name:      "months task overdue with no date baseline",
			now:       testNow,
			task:      monthsTask(12),
			equipment: decommissioned(noMeter(), "2026-03-01"),
			want:      dueStatusWant{},
		},
		{
			name:      "months task done long ago",
			now:       testNow,
			task:      monthsTask(6),
			equipment: decommissioned(noMeter(), "2026-03-01"),
			last:      done(midnight(2024, time.January, 10)),
			want:      dueStatusWant{},
		},
		{
			name:      "months and hours task overdue by hours",
			now:       testNow,
			task:      bothTask(24, 100),
			equipment: decommissioned(meter(900), "2026-03-01"),
			last:      doneAt(midnight(2026, time.May, 1), 500),
			want:      dueStatusWant{},
		},
		{
			name:      "task just done, ok",
			now:       testNow,
			task:      monthsTask(12),
			equipment: decommissioned(noMeter(), "2026-06-15"),
			last:      done(midnight(2026, time.June, 14)),
			want:      dueStatusWant{},
		},
		{
			name:      "expiry task with an expired part",
			now:       testNow,
			task:      expiryTask(""),
			equipment: decommissioned(noMeter(), "2026-03-01"),
			last:      fitted(midnight(2024, time.January, 15), "2025-01-15"),
			want:      dueStatusWant{},
		},
		{
			name:      "expiry task with no expiry date",
			now:       testNow,
			task:      expiryTask(""),
			equipment: decommissioned(noMeter(), "2026-03-01"),
			want:      dueStatusWant{},
		},
		{
			// An empty date is no date: the equipment is in service and the
			// task is overdue with no date baseline, as usual.
			name:      "empty decommissioning date is in service",
			now:       testNow,
			task:      monthsTask(12),
			equipment: decommissioned(noMeter(), ""),
			want:      dueStatusWant{status: "overdue", trigger: TriggerMonths},
		},
	})
}
