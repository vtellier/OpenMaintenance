package handlers

import (
	"database/sql"
	"fmt"

	"github.com/labstack/echo/v4"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/logic"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

func (h *Handler) enrichTask(task *models.Task) {
	equipment, err := dbpackage.GetEquipment(h.DB, task.EquipmentID)
	if err != nil {
		return
	}

	lastIntervention, _ := dbpackage.GetLastInterventionByTask(h.DB, task.ID)

	status, nextDate, nextHours := logic.ComputeDueStatus(*task, *equipment, lastIntervention)
	task.DueStatus = status
	task.NextDueDate = nextDate
	task.NextDueHours = nextHours
}

func (h *Handler) ListTasks(ctx echo.Context) error {
	tasks, err := dbpackage.ListTasks(h.DB)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	for i := range tasks {
		h.enrichTask(&tasks[i])
	}

	return ctx.JSON(200, tasks)
}

func (h *Handler) ListTasksByEquipment(ctx echo.Context, equipmentId int) error {
	tasks, err := dbpackage.ListTasksByEquipment(h.DB, equipmentId)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	for i := range tasks {
		h.enrichTask(&tasks[i])
	}

	return ctx.JSON(200, tasks)
}

func (h *Handler) CreateTask(ctx echo.Context) error {
	task := new(models.Task)
	if err := ctx.Bind(task); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	if task.EquipmentID <= 0 {
		return ctx.JSON(400, map[string]string{"error": "equipment_id is required and must be a positive integer"})
	}

	if err := validateTaskIntervals(h.DB, task); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	if err := dbpackage.CreateTask(h.DB, task); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	h.enrichTask(task)

	return ctx.JSON(201, task)
}

func (h *Handler) GetTask(ctx echo.Context, id int) error {
	task, err := dbpackage.GetTask(h.DB, id)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "Task not found"})
	}

	h.enrichTask(task)

	return ctx.JSON(200, task)
}

func (h *Handler) UpdateTask(ctx echo.Context, id int) error {
	task := new(models.Task)
	if err := ctx.Bind(task); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}
	task.ID = id

	if err := validateTaskIntervals(h.DB, task); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}

	if err := dbpackage.UpdateTask(h.DB, task); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	h.enrichTask(task)

	return ctx.JSON(200, task)
}

func validateTaskIntervals(db *sql.DB, task *models.Task) error {
	if task.HoursInterval == nil && task.MonthsInterval == nil {
		return fmt.Errorf("at least one of hours_interval or months_interval must be set")
	}

	if task.HoursInterval != nil {
		equipment, err := dbpackage.GetEquipment(db, task.EquipmentID)
		if err != nil {
			return fmt.Errorf("equipment not found: %w", err)
		}
		if !equipment.TracksHours {
			return fmt.Errorf("hours_interval requires the equipment to have hour-meter tracking enabled")
		}
	}

	return nil
}

func (h *Handler) DeleteTask(ctx echo.Context, id int) error {
	// Capture the task's interventions before they cascade away, so their photo
	// directories can be cleaned up from disk afterwards.
	interventions, _ := dbpackage.ListInterventionsByTask(h.DB, id)

	if err := dbpackage.DeleteTask(h.DB, id); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	for _, inv := range interventions {
		if inv.EquipmentID != nil {
			h.removeInterventionFilesDir(*inv.EquipmentID, inv.ID)
		}
	}

	return ctx.NoContent(204)
}
