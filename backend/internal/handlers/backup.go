package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/db"
)

type backupFileResp struct {
	Name      string `json:"name"`
	Size      int64  `json:"size"`
	CreatedAt string `json:"created_at"`
}

type backupStatusResp struct {
	Enabled bool             `json:"enabled"`
	Path    string           `json:"path"`
	Keep    int              `json:"keep"`
	Files   []backupFileResp `json:"files"`
}

func (h *Handler) GetBackupStatus(ctx echo.Context) error {
	resp := backupStatusResp{
		Enabled: h.BackupEnabled,
		Path:    h.BackupPath,
		Keep:    h.BackupKeep,
		Files:   []backupFileResp{},
	}

	if h.BackupEnabled {
		backups, err := db.ListBackups(h.BackupPath)
		if err != nil {
			log.Printf("backup: cannot list %s: %v", h.BackupPath, err)
		}
		for _, b := range backups {
			resp.Files = append(resp.Files, backupFileResp{
				Name:      b.Name,
				Size:      b.Size,
				CreatedAt: b.CreatedAt.UTC().Format(time.RFC3339),
			})
		}
	}

	return ctx.JSON(http.StatusOK, resp)
}
