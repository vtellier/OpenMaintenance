package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/vtellier/OpenMaintenance/internal/config"
	"github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/filestore"
	"github.com/vtellier/OpenMaintenance/internal/generated"
	"github.com/vtellier/OpenMaintenance/internal/handlers"
	"github.com/vtellier/OpenMaintenance/internal/updater"
	_ "github.com/mattn/go-sqlite3"
)

// Version is injected at build time via -ldflags "-X main.Version=..."
var Version = "dev"

//go:embed static
var staticFiles embed.FS

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	database, err := db.InitDB(cfg.Database.Path, Version, db.BackupConfig{
		Enabled: cfg.Backup.Enabled,
		Path:    cfg.Backup.Path,
		Keep:    cfg.Backup.Keep,
	})
	if err != nil {
		log.Fatal(err)
	}
	defer database.Close()

	baseDir, err := filestore.BaseDir(cfg.Database.Path)
	if err != nil {
		log.Fatal(err)
	}
	if err := filestore.EnsureFilesDir(baseDir); err != nil {
		log.Fatal(err)
	}

	log.Printf("OpenMaintenance %s — db=%s port=%d", Version, cfg.Database.Path, cfg.Server.Port)

	e := echo.New()
	e.HideBanner = true

	e.Use(middleware.Logger())
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

	backupPath := cfg.Backup.Path
	if !filepath.IsAbs(backupPath) {
		exe, err := os.Executable()
		if err != nil {
			log.Fatal(err)
		}
		backupPath = filepath.Join(filepath.Dir(exe), backupPath)
	}

	h := &handlers.Handler{
		DB:            database,
		Version:       Version,
		BaseDir:       baseDir,
		BackupEnabled: cfg.Backup.Enabled,
		BackupPath:    backupPath,
		BackupKeep:    cfg.Backup.Keep,
	}
	// Pre-populate CurrentVersion so the API always returns a valid version
	// string even before the background GitHub check completes.
	h.SetUpdateStatus(updater.UpdateStatus{CurrentVersion: Version})
	generated.RegisterHandlersWithBaseURL(e, h, "/api")

	go func() {
		status := updater.CheckLatestRelease(context.Background(), Version)
		h.SetUpdateStatus(status)
	}()

	log.Fatal(e.Start(fmt.Sprintf(":%d", cfg.Server.Port)))
}
