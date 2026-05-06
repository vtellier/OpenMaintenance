package routes

import (
	"database/sql"
	"github.com/gofiber/fiber/v2"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/models"
	"strconv"
)

func SetupInterventionRoutes(api fiber.Router, database *sql.DB) {
	api.Get("/interventions", func(c *fiber.Ctx) error {
		interventions, err := dbpackage.ListInterventions(database)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(interventions)
	})

	api.Get("/tasks/:task_id/interventions", func(c *fiber.Ctx) error {
		taskID, _ := strconv.Atoi(c.Params("task_id"))
		interventions, err := dbpackage.ListInterventionsByTask(database, taskID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(interventions)
	})

	api.Post("/interventions", func(c *fiber.Ctx) error {
		intervention := new(models.Intervention)
		if err := c.BodyParser(intervention); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}

		if err := dbpackage.CreateIntervention(database, intervention); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(intervention)
	})

	api.Get("/interventions/:id", func(c *fiber.Ctx) error {
		id, _ := strconv.Atoi(c.Params("id"))
		intervention, err := dbpackage.GetIntervention(database, id)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Intervention not found"})
		}
		return c.JSON(intervention)
	})

	api.Put("/interventions/:id", func(c *fiber.Ctx) error {
		id, _ := strconv.Atoi(c.Params("id"))
		intervention := new(models.Intervention)
		if err := c.BodyParser(intervention); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}
		intervention.ID = id

		if err := dbpackage.UpdateIntervention(database, intervention); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(intervention)
	})

	api.Delete("/interventions/:id", func(c *fiber.Ctx) error {
		id, _ := strconv.Atoi(c.Params("id"))
		if err := dbpackage.DeleteIntervention(database, id); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.SendStatus(204)
	})
}