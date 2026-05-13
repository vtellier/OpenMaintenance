package handlers

import (
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

	if err := dbpackage.CreateIntervention(h.DB, intervention); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

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

	if err := dbpackage.UpdateIntervention(h.DB, intervention); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	return ctx.JSON(200, intervention)
}

func (h *Handler) DeleteIntervention(ctx echo.Context, id int) error {
	if err := dbpackage.DeleteIntervention(h.DB, id); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	return ctx.NoContent(204)
}
