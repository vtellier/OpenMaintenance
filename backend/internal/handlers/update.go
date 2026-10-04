package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/generated"
	"github.com/vtellier/OpenMaintenance/internal/updater"
)

// GetUpdateStatus returns the result of the last update check. It never
// queries GitHub.
func (h *Handler) GetUpdateStatus(ctx echo.Context) error {
	return ctx.JSON(http.StatusOK, toUpdateStatusResponse(h.Updates.Status()))
}

// CheckForUpdates queries GitHub now, unless the previous check is too recent
// (see updater.Checker.Check). A failed check still answers 200: the reason
// is in the body.
func (h *Handler) CheckForUpdates(ctx echo.Context) error {
	status := h.Updates.Check(ctx.Request().Context())
	resp := toUpdateStatusResponse(status)
	resp.Cached = &status.Cached
	return ctx.JSON(http.StatusOK, resp)
}

func toUpdateStatusResponse(s updater.UpdateStatus) generated.UpdateStatus {
	resp := generated.UpdateStatus{
		CurrentVersion:  s.CurrentVersion,
		LatestVersion:   s.LatestVersion,
		UpdateAvailable: s.UpdateAvailable,
	}
	if s.ReleaseURL != "" {
		resp.ReleaseUrl = &s.ReleaseURL
	}
	if !s.CheckedAt.IsZero() {
		checkedAt := s.CheckedAt.UTC()
		resp.CheckedAt = &checkedAt
	}
	if s.Failure != "" {
		failure := generated.UpdateStatusError(s.Failure)
		resp.Error = &failure
	}
	return resp
}
