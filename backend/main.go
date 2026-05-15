package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/vtellier/OpenMaintenance/internal/config"
	"github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/generated"
	"github.com/vtellier/OpenMaintenance/internal/handlers"
	_ "github.com/mattn/go-sqlite3"
)

//go:embed static
var staticFiles embed.FS

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	database, err := db.InitDB(cfg.Database.Path)
	if err != nil {
		log.Fatal(err)
	}
	defer database.Close()

	e := echo.New()

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"http://localhost:3000", "http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:5174", "http://localhost:5174"},
		AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.DELETE},
	}))

	sub, err := fs.Sub(staticFiles, "static")
	if err != nil {
		log.Fatal(err)
	}
	fileServer := http.FileServer(http.FS(sub))
	e.GET("/*", func(c echo.Context) error {
		path := c.Request().URL.Path
		// Check if the file exists in the embedded FS
		if _, err := fs.Stat(sub, path[1:]); err != nil {
			// Serve index.html for SPA client-side routing
			c.Request().URL.Path = "/"
		}
		echo.WrapHandler(fileServer)(c)
		return nil
	})

	h := &handlers.Handler{DB: database}
	generated.RegisterHandlersWithBaseURL(e, h, "/api")

	log.Fatal(e.Start(fmt.Sprintf(":%d", cfg.Server.Port)))
}
