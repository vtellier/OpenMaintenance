package routes

import (
	"database/sql"
	"github.com/gofiber/fiber/v2"
)

func SetupInterventionRoutes(app *fiber.App, db *sql.DB) {
	app.Get("/interventions", func(c *fiber.Ctx) error {
		// List all interventions
		return c.JSON(fiber.Map{"message": "List interventions"})
	})

	app.Post("/interventions", func(c *fiber.Ctx) error {
		// Create new intervention
		return c.JSON(fiber.Map{"message": "Create intervention"})
	})

	app.Get("/interventions/:id", func(c *fiber.Ctx) error {
		// Get intervention by ID
		return c.JSON(fiber.Map{"message": "Get intervention"})
	})

	app.Put("/interventions/:id", func(c *fiber.Ctx) error {
		// Update intervention
		return c.JSON(fiber.Map{"message": "Update intervention"})
	})

	app.Delete("/interventions/:id", func(c *fiber.Ctx) error {
		// Delete intervention
		return c.JSON(fiber.Map{"message": "Delete intervention"})
	})
}