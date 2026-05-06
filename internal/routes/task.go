package routes

import (
	"database/sql"
	"github.com/gofiber/fiber/v2"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/models"
	"strconv"
)

func SetupTaskRoutes(app *fiber.App, database *sql.DB) {
	app.Get("/tasks", func(c *fiber.Ctx) error {
		tasks, err := dbpackage.ListTasks(database)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(tasks)
	})

	app.Get("/equipments/:equipment_id/tasks", func(c *fiber.Ctx) error {
		equipmentID, _ := strconv.Atoi(c.Params("equipment_id"))
		tasks, err := dbpackage.ListTasksByEquipment(database, equipmentID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(tasks)
	})

	app.Post("/tasks", func(c *fiber.Ctx) error {
		task := new(models.Task)
		if err := c.BodyParser(task); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}

		if err := dbpackage.CreateTask(database, task); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(task)
	})

	app.Get("/tasks/:id", func(c *fiber.Ctx) error {
		id, _ := strconv.Atoi(c.Params("id"))
		task, err := dbpackage.GetTask(database, id)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Task not found"})
		}
		return c.JSON(task)
	})

	app.Put("/tasks/:id", func(c *fiber.Ctx) error {
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

	app.Delete("/tasks/:id", func(c *fiber.Ctx) error {
		id, _ := strconv.Atoi(c.Params("id"))
		if err := dbpackage.DeleteTask(database, id); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.SendStatus(204)
	})
}