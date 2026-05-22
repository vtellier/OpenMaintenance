package handlers

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/labstack/echo/v4"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

func (h *Handler) ListInterventions(ctx echo.Context) error {
	interventions, err := dbpackage.ListInterventions(h.DB)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	return ctx.JSON(200, interventions)
}

func (h *Handler) ListInterventionsByTask(ctx echo.Context, taskId int) error {
	interventions, err := dbpackage.ListInterventionsByTask(h.DB, taskId)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	return ctx.JSON(200, interventions)
}

func (h *Handler) CreateIntervention(ctx echo.Context) error {
	intervention := new(models.Intervention)
	if err := ctx.Bind(intervention); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	if err := validateIntervention(intervention); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	if intervention.TaskID != nil {
		if err := populateEquipmentIDFromTask(h.DB, intervention); err != nil {
			return ctx.JSON(400, map[string]string{"error": err.Error()})
		}
	}

	if err := dbpackage.CreateIntervention(h.DB, intervention); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	updateEquipmentHoursFromIntervention(h.DB, intervention)

	return ctx.JSON(201, intervention)
}

func (h *Handler) GetIntervention(ctx echo.Context, id int) error {
	intervention, err := dbpackage.GetIntervention(h.DB, id)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "Intervention not found"})
	}
	return ctx.JSON(200, intervention)
}

func (h *Handler) UpdateIntervention(ctx echo.Context, id int) error {
	intervention := new(models.Intervention)
	if err := ctx.Bind(intervention); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}
	intervention.ID = id

	if err := validateIntervention(intervention); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	if intervention.TaskID != nil {
		if err := populateEquipmentIDFromTask(h.DB, intervention); err != nil {
			return ctx.JSON(400, map[string]string{"error": err.Error()})
		}
	}

	if err := dbpackage.UpdateIntervention(h.DB, intervention); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	updateEquipmentHoursFromIntervention(h.DB, intervention)

	return ctx.JSON(200, intervention)
}

func (h *Handler) DeleteIntervention(ctx echo.Context, id int) error {
	if err := dbpackage.DeleteIntervention(h.DB, id); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	return ctx.NoContent(204)
}

func validateIntervention(intervention *models.Intervention) error {
	if intervention.Date.After(time.Now()) {
		return fmt.Errorf("intervention date cannot be in the future")
	}
	if intervention.TaskID == nil {
		if intervention.EquipmentID == nil {
			return fmt.Errorf("equipment_id is required for exceptional interventions")
		}
		if intervention.ExceptionalLabel == nil || *intervention.ExceptionalLabel == "" {
			return fmt.Errorf("exceptional_label is required for exceptional interventions")
		}
	}
	return nil
}

func populateEquipmentIDFromTask(db *sql.DB, intervention *models.Intervention) error {
	task, err := dbpackage.GetTask(db, *intervention.TaskID)
	if err != nil {
		return fmt.Errorf("task not found")
	}
	intervention.EquipmentID = &task.EquipmentID
	return nil
}

func updateEquipmentHoursFromIntervention(db *sql.DB, intervention *models.Intervention) {
	if intervention.HoursAt == nil || intervention.EquipmentID == nil {
		return
	}

	equipment, err := dbpackage.GetEquipment(db, *intervention.EquipmentID)
	if err != nil {
		return
	}

	if equipment.Hours == nil || *intervention.HoursAt > *equipment.Hours {
		now := time.Now()
		equipment.Hours = intervention.HoursAt
		equipment.HoursUpdatedAt = &now
		dbpackage.UpdateEquipment(db, equipment)
	}
}
