package routes

import (
	"database/sql"
	"github.com/labstack/echo/v4"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/models"
	"strconv"
)

func SetupEquipmentRoutes(api *echo.Group, database *sql.DB) {
	api.GET("/equipments", func(c echo.Context) error {
		equipments, err := dbpackage.ListEquipments(database)
		if err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}
		return c.JSON(200, equipments)
	})

	api.POST("/equipments", func(c echo.Context) error {
		equipment := new(models.Equipment)
		if err := c.Bind(equipment); err != nil {
			return c.JSON(400, map[string]string{"error": err.Error()})
		}

		if err := dbpackage.CreateEquipment(database, equipment); err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}

		return c.JSON(201, equipment)
	})

	api.GET("/equipments/:id", func(c echo.Context) error {
		id, _ := strconv.Atoi(c.Param("id"))
		equipment, err := dbpackage.GetEquipment(database, id)
		if err != nil {
			return c.JSON(404, map[string]string{"error": "Equipment not found"})
		}
		return c.JSON(200, equipment)
	})

	api.PUT("/equipments/:id", func(c echo.Context) error {
		id, _ := strconv.Atoi(c.Param("id"))
		equipment := new(models.Equipment)
		if err := c.Bind(equipment); err != nil {
			return c.JSON(400, map[string]string{"error": err.Error()})
		}
		equipment.ID = id

		if err := dbpackage.UpdateEquipment(database, equipment); err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}

		return c.JSON(200, equipment)
	})

	api.DELETE("/equipments/:id", func(c echo.Context) error {
		id, _ := strconv.Atoi(c.Param("id"))
		if err := dbpackage.DeleteEquipment(database, id); err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}
		return c.NoContent(204)
	})
}