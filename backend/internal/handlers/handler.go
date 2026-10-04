package handlers

import (
	"database/sql"

	"github.com/vtellier/OpenMaintenance/internal/generated"
	"github.com/vtellier/OpenMaintenance/internal/updater"
)

type Handler struct {
	DB            *sql.DB
	Version       string
	BaseDir       string // directory that contains the files/ tree
	BackupEnabled bool
	BackupPath    string // absolute path to the backup directory
	BackupKeep    int
	Updates       *updater.Checker // checks GitHub for a newer release
}

var _ generated.ServerInterface = (*Handler)(nil)
