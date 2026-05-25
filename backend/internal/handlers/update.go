package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/generated"
)

func (h *Handler) GetUpdateStatus(ctx echo.Context) error {
	h.updateStatusMu.RLock()
	status := h.updateStatus
	h.updateStatusMu.RUnlock()

	resp := generated.UpdateStatus{
		CurrentVersion:  status.CurrentVersion,
		LatestVersion:   status.LatestVersion,
		UpdateAvailable: status.UpdateAvailable,
	}
	if status.ReleaseURL != "" {
		resp.ReleaseUrl = &status.ReleaseURL
	}
	return ctx.JSON(http.StatusOK, resp)
}
