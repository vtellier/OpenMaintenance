package handlers

import (
	"time"

	"github.com/labstack/echo/v4"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
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
	equipment := new(models.Equipment)
	if err := ctx.Bind(equipment); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	if equipment.TracksHours && equipment.Hours != nil {
		now := time.Now()
		equipment.HoursUpdatedAt = &now
	}

	if err := dbpackage.CreateEquipment(h.DB, equipment); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
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

func (h *Handler) UpdateEquipment(ctx echo.Context, id int) error {
	equipment := new(models.Equipment)
	if err := ctx.Bind(equipment); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}
	equipment.ID = id

	if equipment.TracksHours && equipment.Hours != nil {
		existing, err := dbpackage.GetEquipment(h.DB, id)
		if err == nil && (existing.Hours == nil || *equipment.Hours > *existing.Hours) {
			now := time.Now()
			equipment.HoursUpdatedAt = &now
		}
	}

	if err := dbpackage.UpdateEquipment(h.DB, equipment); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	return ctx.JSON(200, equipment)
}

// UpdateEquipmentHours records an explicit hour-meter reading. The submitted
// value must be >= the current one, and hours_updated_at is always refreshed to
// now — even when the value is unchanged — so the user can dismiss the Dashboard
// freshness reminder when the equipment simply has not run.
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
	if !existing.TracksHours {
		return ctx.JSON(400, map[string]string{"error": "Equipment does not track hours"})
	}
	if existing.Hours != nil && input.Hours < *existing.Hours {
		return ctx.JSON(400, map[string]string{"error": "Hours cannot be lower than the current value"})
	}

	now := time.Now()
	existing.Hours = &input.Hours
	existing.HoursUpdatedAt = &now

	if err := dbpackage.UpdateEquipment(h.DB, existing); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
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
