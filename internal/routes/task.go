package routes

import (
	"database/sql"
	"github.com/gofiber/fiber/v2"
)

func SetupTaskRoutes(app *fiber.App, db *sql.DB) {
	app.Get("/tasks", func(c *fiber.Ctx) error {
		// List all tasks
		return c.JSON(fiber.Map{"message": "List tasks"})
	})

	app.Post("/tasks", func(c *fiber.Ctx) error {
		// Create new task
		return c.JSON(fiber.Map{"message": "Create task"})
	})

	app.Get("/tasks/:id", func(c *fiber.Ctx) error {
		// Get task by ID
		return c.JSON(fiber.Map{"message": "Get task"})
	})

	app.Put("/tasks/:id", func(c *fiber.Ctx) error {
		// Update task
		return c.JSON(fiber.Map{"message": "Update task"})
	})

	app.Delete("/tasks/:id", func(c *fiber.Ctx) error {
		// Delete task
		return c.JSON(fiber.Map{"message": "Delete task"})
	})
}