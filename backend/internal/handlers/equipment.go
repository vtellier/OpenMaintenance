package handlers

import (
	"errors"

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
// and its freshness alone (the request's hours is ignored), except when the
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

func (h *Handler) DeleteEquipment(ctx echo.Context, id int) error {
	if err := dbpackage.DeleteEquipment(h.DB, id); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	h.removeEquipmentFilesDir(id)
	return ctx.NoContent(204)
}

// equipmentMetadata copies the fields a create or edit request sets directly.
// The hour-meter reading and its freshness are left out on purpose: only the
// hourmeter package changes them.
func equipmentMetadata(in *models.Equipment) *models.Equipment {
	return &models.Equipment{
		Name:           in.Name,
		Description:    in.Description,
		CommissionedAt: in.CommissionedAt,
		Icon:           in.Icon,
		TracksHours:    in.TracksHours,
	}
}

// hourMeterStatus maps an hourmeter error to an HTTP status: a broken
// hour-meter rule is a bad request, anything else a server error.
func hourMeterStatus(err error) int {
	if errors.Is(err, hourmeter.ErrBackwards) || errors.Is(err, hourmeter.ErrNotTracked) {
		return 400
	}
	return 500
}
