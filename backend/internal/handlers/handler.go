package handlers

import (
	"database/sql"
	"github.com/vtellier/OpenMaintenance/internal/generated"
)

type Handler struct {
	DB      *sql.DB
	Version string
}

var _ generated.ServerInterface = (*Handler)(nil)
