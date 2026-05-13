package handlers

import (
	"database/sql"
	"github.com/vtellier/OpenMaintenance/internal/generated"
)

type Handler struct {
	DB *sql.DB
}

var _ generated.ServerInterface = (*Handler)(nil)
