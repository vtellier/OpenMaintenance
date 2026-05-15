package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/generated"
)

func (h *Handler) GetVersion(ctx echo.Context) error {
	return ctx.JSON(http.StatusOK, generated.VersionInfo{Version: h.Version})
}
