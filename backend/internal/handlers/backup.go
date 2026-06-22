package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/labstack/echo/v4"
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
		pattern := filepath.Join(h.BackupPath, "*.bak")
		matches, err := filepath.Glob(pattern)
		if err == nil && len(matches) > 0 {
			sort.Sort(sort.Reverse(sort.StringSlice(matches)))
			for _, m := range matches {
				info, err := os.Stat(m)
				if err != nil {
					continue
				}
				resp.Files = append(resp.Files, backupFileResp{
					Name:      filepath.Base(m),
					Size:      info.Size(),
					CreatedAt: info.ModTime().UTC().Format(time.RFC3339),
				})
			}
		}
	}

	return ctx.JSON(http.StatusOK, resp)
}
