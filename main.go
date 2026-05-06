package main

import (
	"log"
	"github.com/gofiber/fiber/v2"
	"github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/routes"
	_ "github.com/mattn/go-sqlite3"
)

func main() {
	// Initialize database
	db, err := db.InitDB()
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Initialize Fiber app
	app := fiber.New()
	app.Static("/", "./static")

	// Setup routes
	routes.SetupEquipmentRoutes(app, db)
	routes.SetupTaskRoutes(app, db)
	routes.SetupInterventionRoutes(app, db)

	log.Fatal(app.Listen(":3000"))
}