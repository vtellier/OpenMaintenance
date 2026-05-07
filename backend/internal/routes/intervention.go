package routes

import (
	"database/sql"
	"github.com/labstack/echo/v4"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/models"
	"strconv"
)

func SetupInterventionRoutes(api *echo.Group, database *sql.DB) {
	api.GET("/interventions", func(c echo.Context) error {
		interventions, err := dbpackage.ListInterventions(database)
		if err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}
		return c.JSON(200, interventions)
	})

	api.GET("/tasks/:task_id/interventions", func(c echo.Context) error {
		taskID, _ := strconv.Atoi(c.Param("task_id"))
		interventions, err := dbpackage.ListInterventionsByTask(database, taskID)
		if err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}
		return c.JSON(200, interventions)
	})

	api.POST("/interventions", func(c echo.Context) error {
		intervention := new(models.Intervention)
		if err := c.Bind(intervention); err != nil {
			return c.JSON(400, map[string]string{"error": err.Error()})
		}

		if err := dbpackage.CreateIntervention(database, intervention); err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}

		return c.JSON(201, intervention)
	})

	api.GET("/interventions/:id", func(c echo.Context) error {
		id, _ := strconv.Atoi(c.Param("id"))
		intervention, err := dbpackage.GetIntervention(database, id)
		if err != nil {
			return c.JSON(404, map[string]string{"error": "Intervention not found"})
		}
		return c.JSON(200, intervention)
	})

	api.PUT("/interventions/:id", func(c echo.Context) error {
		id, _ := strconv.Atoi(c.Param("id"))
		intervention := new(models.Intervention)
		if err := c.Bind(intervention); err != nil {
			return c.JSON(400, map[string]string{"error": err.Error()})
		}
		intervention.ID = id

		if err := dbpackage.UpdateIntervention(database, intervention); err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}

		return c.JSON(200, intervention)
	})

	api.DELETE("/interventions/:id", func(c echo.Context) error {
		id, _ := strconv.Atoi(c.Param("id"))
		if err := dbpackage.DeleteIntervention(database, id); err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}
		return c.NoContent(204)
	})
}