package main

import (
	"log"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
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

	// Initialize Echo app
	e := echo.New()

	// Enable CORS for React frontend
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"http://localhost:3000"},
		AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.DELETE},
	}))

	// Serve React static files in production
	e.Static("/", "./static")

	// API routes
	api := e.Group("/api")
	routes.SetupEquipmentRoutes(api, db)
	routes.SetupTaskRoutes(api, db)
	routes.SetupInterventionRoutes(api, db)

	log.Fatal(e.Start(":3001"))
}