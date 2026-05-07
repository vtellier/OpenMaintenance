package routes

import (
	"database/sql"
	"github.com/gofiber/fiber/v2"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/models"
	"strconv"
)

func SetupTaskRoutes(api fiber.Router, database *sql.DB) {
	api.Get("/tasks", func(c *fiber.Ctx) error {
		tasks, err := dbpackage.ListTasks(database)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(tasks)
	})

	api.Get("/equipments/:equipment_id/tasks", func(c *fiber.Ctx) error {
		equipmentID, _ := strconv.Atoi(c.Params("equipment_id"))
		tasks, err := dbpackage.ListTasksByEquipment(database, equipmentID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(tasks)
	})

  api.Post("/tasks", func(c *fiber.Ctx) error {
    task := new(models.Task)
    if err := c.BodyParser(task); err != nil {
      return c.Status(400).JSON(fiber.Map{"error": err.Error()})
    }

    // Validate that equipment_id is provided and is a positive integer
    if task.EquipmentID <= 0 {
      return c.Status(400).JSON(fiber.Map{"error": "equipment_id is required and must be a positive integer"})
    }

    if err := dbpackage.CreateTask(database, task); err != nil {
      return c.Status(500).JSON(fiber.Map{"error": err.Error()})
    }

    return c.JSON(task)
  })

	api.Get("/tasks/:id", func(c *fiber.Ctx) error {
		id, _ := strconv.Atoi(c.Params("id"))
		task, err := dbpackage.GetTask(database, id)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Task not found"})
		}
		return c.JSON(task)
	})

	api.Put("/tasks/:id", func(c *fiber.Ctx) error {
		id, _ := strconv.Atoi(c.Params("id"))
		task := new(models.Task)
		if err := c.BodyParser(task); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}
		task.ID = id

		if err := dbpackage.UpdateTask(database, task); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(task)
	})

	api.Delete("/tasks/:id", func(c *fiber.Ctx) error {
		id, _ := strconv.Atoi(c.Params("id"))
		if err := dbpackage.DeleteTask(database, id); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.SendStatus(204)
	})
}