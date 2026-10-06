package logic

import (
	"testing"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/models"
)

func intPtr(v int) *int { return &v }

func floatPtr(v float64) *float64 { return &v }

func strPtr(v string) *string { return &v }

// daysAgo returns a time N days before the fixed test clock (testNow), useful
// for building baselines relative to "now".
func daysAgo(days int) time.Time {
	return testNow.AddDate(0, 0, -days)
}

// TestComputeDueStatusDateBaseline documents the date baseline used by the
// scheduling engine:
//
//  1. the last intervention's date
//  2. equipment.CommissionedAt when set and parseable
//  3. otherwise there is no date baseline: nobody knows when the task is due,
//     so it is reported "overdue" with no next due date.
//
// equipment.CreatedAt is never used as a baseline: it is only when the row was
// inserted into the app.
//
// Non-regression for issue #59: an equipment commissioned years ago with a task
// that has never been performed must not be reported as "ok" just because the
// equipment row was inserted into the database today.
func TestComputeDueStatusDateBaseline(t *testing.T) {
	tests := []struct {
		name           string
		task           models.Task
		equipment      models.Equipment
		last           *models.Intervention
		wantStatus     string
		wantNextDue    string
		wantNextDueSet bool
	}{
		{
			// Issue #59: boat commissioned 3 years ago, 6-month task, no
			// intervention ever logged -> must be overdue, not "ok".
			name: "no intervention with old commissioned_at is overdue",
			task: models.Task{MonthsInterval: intPtr(6)},
			equipment: models.Equipment{
				CommissionedAt: strPtr(daysAgo(3 * 365).Format("2006-01-02")),
				CreatedAt:      testNow,
			},
			last:           nil,
			wantStatus:     "overdue",
			wantNextDue:    daysAgo(3*365).AddDate(0, 6, 0).Format("2006-01-02"),
			wantNextDueSet: true,
		},
		{
			name: "no intervention and no commissioned_at is overdue with no next due date",
			task: models.Task{MonthsInterval: intPtr(6)},
			equipment: models.Equipment{
				CommissionedAt: nil,
				CreatedAt:      testNow,
			},
			last:           nil,
			wantStatus:     "overdue",
			wantNextDue:    "",
			wantNextDueSet: true,
		},
		{
			name: "no intervention and no commissioned_at ignores a recent created_at",
			task: models.Task{MonthsInterval: intPtr(6)},
			equipment: models.Equipment{
				CommissionedAt: nil,
				CreatedAt:      testNow,
			},
			last:           nil,
			wantStatus:     "overdue",
			wantNextDue:    "",
			wantNextDueSet: true,
		},
		{
			name: "intervention date wins over commissioned_at",
			task: models.Task{MonthsInterval: intPtr(6)},
			equipment: models.Equipment{
				CommissionedAt: strPtr(daysAgo(3 * 365).Format("2006-01-02")),
				CreatedAt:      daysAgo(3 * 365),
			},
			last:           &models.Intervention{Date: daysAgo(10)},
			wantStatus:     "ok",
			wantNextDue:    daysAgo(10).AddDate(0, 6, 0).Format("2006-01-02"),
			wantNextDueSet: true,
		},
		{
			name: "recent commissioned_at wins over old created_at",
			task: models.Task{MonthsInterval: intPtr(6)},
			equipment: models.Equipment{
				CommissionedAt: strPtr(daysAgo(10).Format("2006-01-02")),
				CreatedAt:      daysAgo(3 * 365),
			},
			last:       nil,
			wantStatus: "ok",
		},
		{
			name: "empty commissioned_at is treated as unset",
			task: models.Task{MonthsInterval: intPtr(6)},
			equipment: models.Equipment{
				CommissionedAt: strPtr(""),
				CreatedAt:      daysAgo(400),
			},
			last:           nil,
			wantStatus:     "overdue",
			wantNextDue:    "",
			wantNextDueSet: true,
		},
		{
			name: "malformed commissioned_at is treated as unset",
			task: models.Task{MonthsInterval: intPtr(6)},
			equipment: models.Equipment{
				CommissionedAt: strPtr("not-a-date"),
				CreatedAt:      daysAgo(400),
			},
			last:           nil,
			wantStatus:     "overdue",
			wantNextDue:    "",
			wantNextDueSet: true,
		},
		{
			name: "malformed commissioned_at does not produce a zero-date next due",
			task: models.Task{MonthsInterval: intPtr(6)},
			equipment: models.Equipment{
				CommissionedAt: strPtr("31/12/2023"),
				CreatedAt:      testNow,
			},
			last:           nil,
			wantStatus:     "overdue",
			wantNextDue:    "",
			wantNextDueSet: true,
		},
		{
			name: "commissioned_at inside the due-soon window",
			task: models.Task{MonthsInterval: intPtr(6)},
			equipment: models.Equipment{
				// 6 months minus ~10 days -> inside the 30-day due-soon margin.
				CommissionedAt: strPtr(testNow.AddDate(0, -6, 10).Format("2006-01-02")),
				CreatedAt:      testNow,
			},
			last:       nil,
			wantStatus: "due_soon",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			due := ComputeDueStatus(tt.task, tt.equipment, tt.last, testNow)
			status, nextDueDate := due.Status, due.NextDueDate

			if status != tt.wantStatus {
				t.Errorf("status = %q, want %q", status, tt.wantStatus)
			}
			if tt.wantNextDueSet && nextDueDate != tt.wantNextDue {
				t.Errorf("nextDueDate = %q, want %q", nextDueDate, tt.wantNextDue)
			}
		})
	}
}

// TestComputeDueStatusHours pins the hour-based paths so the date-baseline work
// does not regress them.
func TestComputeDueStatusHours(t *testing.T) {
	tests := []struct {
		name          string
		task          models.Task
		equipment     models.Equipment
		last          *models.Intervention
		wantStatus    string
		wantNextHours *float64
	}{
		{
			name: "hours overdue since last intervention",
			task: models.Task{HoursInterval: intPtr(100)},
			equipment: models.Equipment{
				TracksHours: true,
				Hours:       floatPtr(650),
				CreatedAt:   testNow,
			},
			last:          &models.Intervention{Date: daysAgo(5), HoursAt: floatPtr(500)},
			wantStatus:    "overdue",
			wantNextHours: floatPtr(600),
		},
		{
			name: "hours due soon within the margin",
			task: models.Task{HoursInterval: intPtr(100)},
			equipment: models.Equipment{
				TracksHours: true,
				Hours:       floatPtr(595),
				CreatedAt:   testNow,
			},
			last:          &models.Intervention{Date: daysAgo(5), HoursAt: floatPtr(500)},
			wantStatus:    "due_soon",
			wantNextHours: floatPtr(600),
		},
		{
			name: "hours ok well before the next trigger",
			task: models.Task{HoursInterval: intPtr(100)},
			equipment: models.Equipment{
				TracksHours: true,
				Hours:       floatPtr(520),
				CreatedAt:   testNow,
			},
			last:          &models.Intervention{Date: daysAgo(5), HoursAt: floatPtr(500)},
			wantStatus:    "ok",
			wantNextHours: floatPtr(600),
		},
		{
			name: "hours interval ignored when equipment does not track hours",
			task: models.Task{HoursInterval: intPtr(100)},
			equipment: models.Equipment{
				TracksHours: false,
				Hours:       floatPtr(9000),
				CreatedAt:   testNow,
			},
			last:          &models.Intervention{Date: daysAgo(5), HoursAt: floatPtr(500)},
			wantStatus:    "ok",
			wantNextHours: nil,
		},
		{
			name: "no intervention baselines hours at zero",
			task: models.Task{HoursInterval: intPtr(100)},
			equipment: models.Equipment{
				TracksHours:    true,
				Hours:          floatPtr(120),
				CommissionedAt: strPtr(daysAgo(3 * 365).Format("2006-01-02")),
				CreatedAt:      testNow,
			},
			last:          nil,
			wantStatus:    "overdue",
			wantNextHours: floatPtr(100),
		},
		{
			name: "worst status wins across date and hours",
			task: models.Task{HoursInterval: intPtr(100), MonthsInterval: intPtr(6)},
			equipment: models.Equipment{
				TracksHours:    true,
				Hours:          floatPtr(510),
				CommissionedAt: strPtr(daysAgo(3 * 365).Format("2006-01-02")),
				CreatedAt:      daysAgo(3 * 365),
			},
			last:          nil,
			wantStatus:    "overdue",
			wantNextHours: floatPtr(100),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			due := ComputeDueStatus(tt.task, tt.equipment, tt.last, testNow)
			status, nextDueHours := due.Status, due.NextDueHours

			if status != tt.wantStatus {
				t.Errorf("status = %q, want %q", status, tt.wantStatus)
			}
			switch {
			case tt.wantNextHours == nil && nextDueHours != nil:
				t.Errorf("nextDueHours = %v, want nil", *nextDueHours)
			case tt.wantNextHours != nil && nextDueHours == nil:
				t.Errorf("nextDueHours = nil, want %v", *tt.wantNextHours)
			case tt.wantNextHours != nil && *nextDueHours != *tt.wantNextHours:
				t.Errorf("nextDueHours = %v, want %v", *nextDueHours, *tt.wantNextHours)
			}
		})
	}
}
