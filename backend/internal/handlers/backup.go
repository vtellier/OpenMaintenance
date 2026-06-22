package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
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
			sort.Slice(matches, func(i, j int) bool {
				return filepath.Base(matches[i]) > filepath.Base(matches[j])
			})
			for _, m := range matches {
				info, err := os.Stat(m)
				if err != nil {
					continue
				}
				resp.Files = append(resp.Files, backupFileResp{
					Name:      filepath.Base(m),
					Size:      info.Size(),
					CreatedAt: createdAtFromFilename(filepath.Base(m), info.ModTime()),
				})
			}
		}
	}

	return ctx.JSON(http.StatusOK, resp)
}

// createdAtFromFilename parses the timestamp embedded in the backup filename
// (<stem>.<YYYYMMDD-HHMMSS>.bak) and falls back to the file's mtime.
func createdAtFromFilename(name string, fallback time.Time) string {
	parts := strings.Split(strings.TrimSuffix(name, ".bak"), ".")
	if len(parts) >= 2 {
		if t, err := time.Parse("20060102-150405", parts[len(parts)-1]); err == nil {
			return t.UTC().Format(time.RFC3339)
		}
	}
	return fallback.UTC().Format(time.RFC3339)
}
