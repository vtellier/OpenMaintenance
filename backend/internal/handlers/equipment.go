package handlers

import (
	"database/sql"
	"errors"
	"time"

	"github.com/labstack/echo/v4"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/hourmeter"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

func (h *Handler) ListEquipments(ctx echo.Context) error {
	equipments, err := dbpackage.ListEquipments(h.DB)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	return ctx.JSON(200, equipments)
}

func (h *Handler) CreateEquipment(ctx echo.Context) error {
	input := new(models.Equipment)
	if err := ctx.Bind(input); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	// Checked before the equipment is stored so that a rejected reading
	// creates nothing.
	if err := checkInputHours(input); err != nil {
		return ctx.JSON(hourMeterStatus(err), map[string]string{"error": err.Error()})
	}
	if status, msg := h.checkEquipmentGroup(input.GroupID); status != 0 {
		return ctx.JSON(status, map[string]string{"error": msg})
	}
	if err := checkDecommissioning(input, time.Now()); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	equipment := equipmentMetadata(input)
	if err := dbpackage.CreateEquipment(h.DB, equipment); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	if equipment.TracksHours {
		if err := hourmeter.TurnOn(h.DB, equipment, input.Hours); err != nil {
			return ctx.JSON(hourMeterStatus(err), map[string]string{"error": err.Error()})
		}
	}

	return ctx.JSON(201, equipment)
}

func (h *Handler) GetEquipment(ctx echo.Context, id int) error {
	equipment, err := dbpackage.GetEquipment(h.DB, id)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "Equipment not found"})
	}
	return ctx.JSON(200, equipment)
}

// UpdateEquipment edits equipment metadata. It leaves the hour-meter reading
// and its freshness alone (the request's hours is ignored, though a negative
// one is refused), except when the
// request turns the hour-meter on: hours is then the initial reading.
func (h *Handler) UpdateEquipment(ctx echo.Context, id int) error {
	input := new(models.Equipment)
	if err := ctx.Bind(input); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	existing, err := dbpackage.GetEquipment(h.DB, id)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "Equipment not found"})
	}

	if err := checkInputHours(input); err != nil {
		return ctx.JSON(hourMeterStatus(err), map[string]string{"error": err.Error()})
	}
	if status, msg := h.checkEquipmentGroup(input.GroupID); status != 0 {
		return ctx.JSON(status, map[string]string{"error": msg})
	}
	if err := checkDecommissioning(input, time.Now()); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	// Recorded before the metadata so that a rejected reading changes nothing.
	if input.TracksHours && !existing.TracksHours {
		if err := hourmeter.TurnOn(h.DB, existing, input.Hours); err != nil {
			return ctx.JSON(hourMeterStatus(err), map[string]string{"error": err.Error()})
		}
	}

	equipment := equipmentMetadata(input)
	equipment.ID = id
	if err := dbpackage.UpdateEquipment(h.DB, equipment); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	updated, err := dbpackage.GetEquipment(h.DB, id)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	return ctx.JSON(200, updated)
}

// UpdateEquipmentHours records an explicit hour-meter reading ("Update hours"
// or "Same hours"). The value must be >= the current one, and hours_updated_at
// is refreshed even when the value is unchanged, so the user can dismiss the
// Dashboard freshness reminder when the equipment simply has not run.
func (h *Handler) UpdateEquipmentHours(ctx echo.Context, id int) error {
	var input struct {
		Hours float64 `json:"hours"`
	}
	if err := ctx.Bind(&input); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	existing, err := dbpackage.GetEquipment(h.DB, id)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "Equipment not found"})
	}
	if err := hourmeter.Confirm(h.DB, existing, input.Hours); err != nil {
		return ctx.JSON(hourMeterStatus(err), map[string]string{"error": err.Error()})
	}

	return ctx.JSON(200, existing)
}

// CorrectEquipmentHours is "Correct reading": it sets the reading the user
// confirms, lower included, and refreshes its freshness. It is the only path
// that can lower the reading (doc/data-model.md, "Correct reading").
func (h *Handler) CorrectEquipmentHours(ctx echo.Context, id int) error {
	// A pointer, so that a body without hours is refused instead of read as 0.
	var input struct {
		Hours *float64 `json:"hours"`
	}
	if err := ctx.Bind(&input); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}
	if input.Hours == nil {
		return ctx.JSON(400, map[string]string{"error": "hours is required"})
	}

	existing, err := dbpackage.GetEquipment(h.DB, id)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "Equipment not found"})
	}
	if err := hourmeter.Correct(h.DB, existing, *input.Hours); err != nil {
		return ctx.JSON(hourMeterStatus(err), map[string]string{"error": err.Error()})
	}

	return ctx.JSON(200, existing)
}

func (h *Handler) DeleteEquipment(ctx echo.Context, id int) error {
	if err := dbpackage.DeleteEquipment(h.DB, h.attachments(), id); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	return ctx.NoContent(204)
}

// equipmentMetadata copies the fields a create or edit request sets directly.
// The hour-meter reading and its freshness are left out on purpose: only the
// hourmeter package changes them.
func equipmentMetadata(in *models.Equipment) *models.Equipment {
	return &models.Equipment{
		Name:             in.Name,
		Description:      in.Description,
		CommissionedAt:   in.CommissionedAt,
		DecommissionedAt: in.DecommissionedAt,
		Icon:             in.Icon,
		GroupID:          in.GroupID,
		TracksHours:      in.TracksHours,
	}
}

// checkEquipmentGroup refuses a group_id that names no existing group. It
// returns the HTTP status and reason of a refusal, or 0 when the group is
// allowed (an existing one, or none).
func (h *Handler) checkEquipmentGroup(groupID *int) (int, string) {
	if groupID == nil {
		return 0, ""
	}
	if _, err := dbpackage.GetGroup(h.DB, *groupID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 400, errGroupNotFound
		}
		return 500, err.Error()
	}
	return 0, ""
}

// earliestZone is the earliest timezone on Earth. The API does not know the
// user's timezone, so a date is in the future only once it is after today
// there: the user's today is never refused.
var earliestZone = time.FixedZone("UTC+14", 14*60*60)

// checkDecommissioning checks a create or edit request's decommissioning
// date (doc/data-model.md, "Decommissioning"). An empty one is none: it is
// cleared, so the equipment is in service. Otherwise it must be a YYYY-MM-DD
// date, not in the future, and not before the commissioning date when that
// is a valid date (a malformed commissioning date is unset).
func checkDecommissioning(in *models.Equipment, now time.Time) error {
	if in.DecommissionedAt != nil && *in.DecommissionedAt == "" {
		in.DecommissionedAt = nil
	}
	if in.DecommissionedAt == nil {
		return nil
	}
	decommissioned, err := time.Parse("2006-01-02", *in.DecommissionedAt)
	if err != nil {
		return errors.New("Decommissioning date must be a YYYY-MM-DD date")
	}
	n := now.In(earliestZone)
	if today := time.Date(n.Year(), n.Month(), n.Day(), 0, 0, 0, 0, time.UTC); decommissioned.After(today) {
		return errors.New("Decommissioning date cannot be in the future")
	}
	if in.CommissionedAt != nil {
		if commissioned, err := time.Parse("2006-01-02", *in.CommissionedAt); err == nil && decommissioned.Before(commissioned) {
			return errors.New("Decommissioning date cannot be before the commissioning date")
		}
	}
	return nil
}

// checkInputHours refuses a negative hours in a create or edit request, even
// when the request does not turn the hour-meter on and the value would be
// ignored.
func checkInputHours(in *models.Equipment) error {
	if in.Hours == nil {
		return nil
	}
	return hourmeter.CheckReading(*in.Hours)
}

// hourMeterStatus maps an hourmeter error to an HTTP status: a broken
// hour-meter rule is a bad request, anything else a server error.
func hourMeterStatus(err error) int {
	if errors.Is(err, hourmeter.ErrBackwards) || errors.Is(err, hourmeter.ErrNotTracked) ||
		errors.Is(err, hourmeter.ErrNegative) {
		return 400
	}
	return 500
}
