package handlers

import (
	"github.com/labstack/echo/v4"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

func (h *Handler) ListTasks(ctx echo.Context) error {
	tasks, err := dbpackage.ListTasks(h.DB)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	return ctx.JSON(200, tasks)
}

func (h *Handler) ListTasksByEquipment(ctx echo.Context, equipmentId int) error {
	tasks, err := dbpackage.ListTasksByEquipment(h.DB, equipmentId)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
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

	if err := dbpackage.CreateTask(h.DB, task); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	return ctx.JSON(201, task)
}

func (h *Handler) GetTask(ctx echo.Context, id int) error {
	task, err := dbpackage.GetTask(h.DB, id)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "Task not found"})
	}
	return ctx.JSON(200, task)
}

func (h *Handler) UpdateTask(ctx echo.Context, id int) error {
	task := new(models.Task)
	if err := ctx.Bind(task); err != nil {
		return ctx.JSON(400, map[string]string{"error": err.Error()})
	}
	task.ID = id

	if err := dbpackage.UpdateTask(h.DB, task); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	return ctx.JSON(200, task)
}

func (h *Handler) DeleteTask(ctx echo.Context, id int) error {
	if err := dbpackage.DeleteTask(h.DB, id); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	return ctx.NoContent(204)
}
