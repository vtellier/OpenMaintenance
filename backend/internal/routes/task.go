package routes

import (
	"database/sql"
	"github.com/labstack/echo/v4"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/models"
	"strconv"
)

func SetupTaskRoutes(api *echo.Group, database *sql.DB) {
	api.GET("/tasks", func(c echo.Context) error {
		tasks, err := dbpackage.ListTasks(database)
		if err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}
		return c.JSON(200, tasks)
	})

	api.GET("/equipments/:equipment_id/tasks", func(c echo.Context) error {
		equipmentID, _ := strconv.Atoi(c.Param("equipment_id"))
		tasks, err := dbpackage.ListTasksByEquipment(database, equipmentID)
		if err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}
		return c.JSON(200, tasks)
	})

  api.POST("/tasks", func(c echo.Context) error {
    task := new(models.Task)
    if err := c.Bind(task); err != nil {
      return c.JSON(400, map[string]string{"error": err.Error()})
    }

    // Validate that equipment_id is provided and is a positive integer
    if task.EquipmentID <= 0 {
      return c.JSON(400, map[string]string{"error": "equipment_id is required and must be a positive integer"})
    }

    if err := dbpackage.CreateTask(database, task); err != nil {
      return c.JSON(500, map[string]string{"error": err.Error()})
    }

    return c.JSON(201, task)
  })

	api.GET("/tasks/:id", func(c echo.Context) error {
		id, _ := strconv.Atoi(c.Param("id"))
		task, err := dbpackage.GetTask(database, id)
		if err != nil {
			return c.JSON(404, map[string]string{"error": "Task not found"})
		}
		return c.JSON(200, task)
	})

	api.PUT("/tasks/:id", func(c echo.Context) error {
		id, _ := strconv.Atoi(c.Param("id"))
		task := new(models.Task)
		if err := c.Bind(task); err != nil {
			return c.JSON(400, map[string]string{"error": err.Error()})
		}
		task.ID = id

		if err := dbpackage.UpdateTask(database, task); err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}

		return c.JSON(200, task)
	})

	api.DELETE("/tasks/:id", func(c echo.Context) error {
		id, _ := strconv.Atoi(c.Param("id"))
		if err := dbpackage.DeleteTask(database, id); err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}
		return c.NoContent(204)
	})
}