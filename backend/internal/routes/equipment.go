package routes

import (
	"database/sql"
	"github.com/gofiber/fiber/v2"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/models"
	"strconv"
)

func SetupEquipmentRoutes(api fiber.Router, database *sql.DB) {
	api.Get("/equipments", func(c *fiber.Ctx) error {
		equipments, err := dbpackage.ListEquipments(database)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(equipments)
	})

	api.Post("/equipments", func(c *fiber.Ctx) error {
		equipment := new(models.Equipment)
		if err := c.BodyParser(equipment); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}

		if err := dbpackage.CreateEquipment(database, equipment); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(equipment)
	})

	api.Get("/equipments/:id", func(c *fiber.Ctx) error {
		id, _ := strconv.Atoi(c.Params("id"))
		equipment, err := dbpackage.GetEquipment(database, id)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Equipment not found"})
		}
		return c.JSON(equipment)
	})

	api.Put("/equipments/:id", func(c *fiber.Ctx) error {
		id, _ := strconv.Atoi(c.Params("id"))
		equipment := new(models.Equipment)
		if err := c.BodyParser(equipment); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}
		equipment.ID = id

		if err := dbpackage.UpdateEquipment(database, equipment); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(equipment)
	})

	api.Delete("/equipments/:id", func(c *fiber.Ctx) error {
		id, _ := strconv.Atoi(c.Params("id"))
		if err := dbpackage.DeleteEquipment(database, id); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.SendStatus(204)
	})
}