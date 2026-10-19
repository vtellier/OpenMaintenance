package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/labstack/echo/v4"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/hourmeter"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

func (h *Handler) ListInterventions(ctx echo.Context) error {
	interventions, err := dbpackage.ListInterventions(h.DB)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	h.attachPhotoCounts(interventions)
	return ctx.JSON(200, interventions)
}

func (h *Handler) ListInterventionsByTask(ctx echo.Context, taskId int) error {
	interventions, err := dbpackage.ListInterventionsByTask(h.DB, taskId)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	h.attachPhotoCounts(interventions)
	return ctx.JSON(200, interventions)
}

// attachPhotoCounts fills the PhotoCount of each intervention from a single
// grouped query, leaving counts at zero if the lookup fails.
func (h *Handler) attachPhotoCounts(interventions []models.Intervention) {
	counts, err := dbpackage.CountInterventionFilesByIntervention(h.DB)
	if err != nil {
		return
	}
	for i := range interventions {
		interventions[i].PhotoCount = counts[interventions[i].ID]
	}
}

func (h *Handler) CreateIntervention(ctx echo.Context) error {
	intervention := new(models.Intervention)
	if err := ctx.Bind(intervention); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	if err := validateIntervention(intervention); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	if err := validateForTask(h.DB, intervention); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	if err := dbpackage.CreateIntervention(h.DB, intervention); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	if err := hourmeter.RecordIntervention(h.DB, intervention); err != nil {
		log.Printf("record hour-meter reading of intervention %d: %v", intervention.ID, err)
	}

	return ctx.JSON(201, intervention)
}

func (h *Handler) GetIntervention(ctx echo.Context, id int) error {
	intervention, err := dbpackage.GetIntervention(h.DB, id)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "Intervention not found"})
	}
	if n, err := dbpackage.CountInterventionFiles(h.DB, id); err == nil {
		intervention.PhotoCount = n
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

	if err := validateForTask(h.DB, intervention); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	if err := h.saveInterventionMovingPhotos(intervention); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	if err := hourmeter.RecordIntervention(h.DB, intervention); err != nil {
		log.Printf("record hour-meter reading of intervention %d: %v", intervention.ID, err)
	}

	return ctx.JSON(200, intervention)
}

func (h *Handler) DeleteIntervention(ctx echo.Context, id int) error {
	// Capture the equipment the intervention belongs to before it is gone, so
	// its photo directory can be cleaned up afterwards.
	existing, _ := dbpackage.GetIntervention(h.DB, id)

	if err := dbpackage.DeleteIntervention(h.DB, id); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	if existing != nil && existing.EquipmentID != nil {
		h.removeInterventionFilesDir(*existing.EquipmentID, id)
	}

	return ctx.NoContent(204)
}

func validateIntervention(intervention *models.Intervention) error {
	if intervention.Date.After(time.Now()) {
		return fmt.Errorf("intervention date cannot be in the future")
	}
	if intervention.HoursAt != nil {
		if err := hourmeter.CheckReading(*intervention.HoursAt); err != nil {
			return fmt.Errorf("hours_at: %w", err)
		}
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

// validateForTask checks what depends on the intervention's task, and takes
// the equipment from it for a standard intervention. A standard intervention
// on an expiry task requires the expiry date of the part fitted, any date,
// past included; no other intervention has one. An empty expiry_date reads as
// none.
func validateForTask(db *sql.DB, intervention *models.Intervention) error {
	if intervention.ExpiryDate != nil && *intervention.ExpiryDate == "" {
		intervention.ExpiryDate = nil
	}

	isExpiryTask := false
	if intervention.TaskID != nil {
		task, err := dbpackage.GetTask(db, *intervention.TaskID)
		if err != nil {
			return fmt.Errorf("task not found")
		}
		intervention.EquipmentID = &task.EquipmentID
		isExpiryTask = task.IsExpiry()
	}

	switch {
	case isExpiryTask && intervention.ExpiryDate == nil:
		return fmt.Errorf("expiry_date is required for an intervention on an expiry task")
	case isExpiryTask && !isCalendarDate(*intervention.ExpiryDate):
		return fmt.Errorf("expiry_date must be a YYYY-MM-DD date")
	case !isExpiryTask && intervention.ExpiryDate != nil:
		return fmt.Errorf("expiry_date is only for interventions on expiry tasks")
	}
	return nil
}
