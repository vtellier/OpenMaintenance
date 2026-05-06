package main

import (
	"log"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
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

	// Enable CORS for React frontend
	app.Use(cors.New(cors.Config{
		AllowOrigins: "http://localhost:3000",
		AllowMethods: "GET,POST,PUT,DELETE",
	}))

	// Serve React static files in production
	app.Static("/", "./static")

	// API routes
	api := app.Group("/api")
	routes.SetupEquipmentRoutes(api, db)
	routes.SetupTaskRoutes(api, db)
	routes.SetupInterventionRoutes(api, db)

	log.Fatal(app.Listen(":3001"))
}