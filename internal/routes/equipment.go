package routes

import (
	"database/sql"
	"github.com/gofiber/fiber/v2"
)

func SetupEquipmentRoutes(app *fiber.App, db *sql.DB) {
	app.Get("/equipments", func(c *fiber.Ctx) error {
		// List all equipments
		return c.JSON(fiber.Map{"message": "List equipments"})
	})

	app.Post("/equipments", func(c *fiber.Ctx) error {
		// Create new equipment
		return c.JSON(fiber.Map{"message": "Create equipment"})
	})

	app.Get("/equipments/:id", func(c *fiber.Ctx) error {
		// Get equipment by ID
		return c.JSON(fiber.Map{"message": "Get equipment"})
	})

	app.Put("/equipments/:id", func(c *fiber.Ctx) error {
		// Update equipment
		return c.JSON(fiber.Map{"message": "Update equipment"})
	})

	app.Delete("/equipments/:id", func(c *fiber.Ctx) error {
		// Delete equipment
		return c.JSON(fiber.Map{"message": "Delete equipment"})
	})
}