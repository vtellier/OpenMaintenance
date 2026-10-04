// Package hourmeter owns every change to an equipment's hour-meter: the
// reading (hours) and its freshness (hours_updated_at). It enforces the rules
// of doc/data-model.md, "What changes the reading":
//
//   - the reading never goes backwards;
//   - an explicit reading (the initial one, "Update hours", "Same hours")
//     always refreshes the freshness, even when the value is unchanged;
//   - a reading captured by an intervention refreshes it only when it raises
//     the reading;
//   - editing equipment metadata touches neither: db.UpdateEquipment does not
//     write them, and only this package calls db.SetEquipmentHours.
package hourmeter

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"

	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

var (
	// ErrNotTracked is returned when confirming the reading of an equipment
	// that does not track hours.
	ErrNotTracked = errors.New("equipment does not track hours")
	// ErrBackwards is returned when an explicit reading is lower than the
	// current one.
	ErrBackwards = errors.New("hours cannot be lower than the current reading")
)

// TurnOn records the initial reading when the hour-meter is turned on, at
// creation or later on an existing equipment. The reading may not be lower
// than one kept from an earlier tracking period. A nil initial records
// nothing. The caller persists tracks_hours itself.
func TurnOn(db *sql.DB, eq *models.Equipment, initial *float64) error {
	if initial == nil {
		return nil
	}
	return confirm(db, eq, *initial)
}

// Confirm records an explicit reading from "Update hours" or "Same hours".
func Confirm(db *sql.DB, eq *models.Equipment, hours float64) error {
	if !eq.TracksHours {
		return ErrNotTracked
	}
	return confirm(db, eq, hours)
}

// RecordIntervention applies the reading captured by an intervention when it
// is logged or edited. It raises the equipment's reading, and refreshes its
// freshness, only when hours_at is strictly greater than the current reading
// and the equipment tracks hours.
func RecordIntervention(db *sql.DB, intervention *models.Intervention) error {
	if intervention.HoursAt == nil || intervention.EquipmentID == nil {
		return nil
	}
	eq, err := dbpackage.GetEquipment(db, *intervention.EquipmentID)
	if err != nil {
		return err
	}
	hours := *intervention.HoursAt
	if !eq.TracksHours || (eq.Hours != nil && hours <= *eq.Hours) {
		return nil
	}
	// A reading raised meanwhile by another request makes this one stale: it
	// changes nothing, like any reading that is not higher.
	if err := write(db, eq, hours); err != nil && !errors.Is(err, ErrBackwards) {
		return err
	}
	return nil
}

// confirm stores an explicit reading: never lower than the current one, and
// fresh even when unchanged.
func confirm(db *sql.DB, eq *models.Equipment, hours float64) error {
	if eq.Hours != nil && hours < *eq.Hours {
		return fmt.Errorf("%w (%s h)", ErrBackwards, strconv.FormatFloat(*eq.Hours, 'f', -1, 64))
	}
	return write(db, eq, hours)
}

// write persists the reading as of now and mirrors it on eq. The database
// refuses to lower the stored reading, so a request racing with one that
// raised it meanwhile gets ErrBackwards instead of moving the meter back.
func write(db *sql.DB, eq *models.Equipment, hours float64) error {
	now := time.Now()
	written, err := dbpackage.SetEquipmentHours(db, eq.ID, hours, now)
	if err != nil {
		return err
	}
	if !written {
		return ErrBackwards
	}
	eq.Hours = &hours
	eq.HoursUpdatedAt = &now
	eq.UpdatedAt = now
	return nil
}
