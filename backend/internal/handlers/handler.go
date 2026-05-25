package handlers

import (
	"database/sql"
	"sync"

	"github.com/vtellier/OpenMaintenance/internal/generated"
	"github.com/vtellier/OpenMaintenance/internal/updater"
)

type Handler struct {
	DB             *sql.DB
	Version        string
	updateStatus   updater.UpdateStatus
	updateStatusMu sync.RWMutex
}

// SetUpdateStatus stores the result of the background update check.
func (h *Handler) SetUpdateStatus(s updater.UpdateStatus) {
	h.updateStatusMu.Lock()
	h.updateStatus = s
	h.updateStatusMu.Unlock()
}

var _ generated.ServerInterface = (*Handler)(nil)
