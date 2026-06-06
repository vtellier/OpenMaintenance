package handlers

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/labstack/echo/v4"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/filestore"
	"github.com/vtellier/OpenMaintenance/internal/generated"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

// imageExtByMime maps the allowed image MIME types to the extension used for
// the stored file. The MIME type is sniffed from the file's leading bytes, not
// trusted from the supplied filename.
var imageExtByMime = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

// resolveIntervention loads an intervention and the equipment it belongs to.
// Photos are addressed by intervention id alone; the equipment is needed only
// to build the on-disk path. It returns a 404 JSON error when the intervention
// is missing or has no owning equipment.
func (h *Handler) resolveIntervention(ctx echo.Context, interventionID int) (*models.Intervention, int, error) {
	inv, err := dbpackage.GetIntervention(h.DB, interventionID)
	if err != nil {
		return nil, 0, ctx.JSON(404, map[string]string{"error": "Intervention not found"})
	}
	if inv.EquipmentID == nil {
		return nil, 0, ctx.JSON(404, map[string]string{"error": "Intervention not found"})
	}
	return inv, *inv.EquipmentID, nil
}

// interventionFileResponse builds the API FileInfo object for a stored photo.
func (h *Handler) interventionFileResponse(interventionID int, f models.InterventionFile) generated.FileInfo {
	name := filepath.Base(f.FilePath)
	abs := filestore.Abs(h.BaseDir, f.FilePath)

	var size int64
	if info, err := os.Stat(abs); err == nil {
		size = info.Size()
	}

	return generated.FileInfo{
		Name:         name,
		OriginalName: f.OriginalName,
		Size:         size,
		MimeType:     detectMime(abs),
		UploadedAt:   f.UploadedAt,
		Url:          fmt.Sprintf("/api/interventions/%d/files/%s", interventionID, name),
	}
}

func (h *Handler) ListInterventionFiles(ctx echo.Context, id int) error {
	if _, _, err := h.resolveIntervention(ctx, id); err != nil {
		return err
	}

	rows, err := dbpackage.ListInterventionFiles(h.DB, id)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	files := make([]generated.FileInfo, 0, len(rows))
	for _, r := range rows {
		files = append(files, h.interventionFileResponse(id, r))
	}
	return ctx.JSON(200, files)
}

func (h *Handler) UploadInterventionFile(ctx echo.Context, id int) error {
	_, equipmentID, err := h.resolveIntervention(ctx, id)
	if err != nil {
		return err
	}

	fileHeader, err := ctx.FormFile("file")
	if err != nil {
		return ctx.JSON(400, map[string]string{"error": "missing file"})
	}
	if fileHeader.Size > filestore.MaxImageSize {
		return ctx.JSON(413, map[string]string{"error": "file exceeds the 10 MB limit"})
	}

	src, err := fileHeader.Open()
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	defer src.Close()

	// Sniff the MIME type from the leading bytes and reject anything that is not
	// an allowed image before writing to disk.
	head := make([]byte, 512)
	n, _ := io.ReadFull(src, head)
	mimeType := http.DetectContentType(head[:n])
	ext, ok := imageExtByMime[mimeType]
	if !ok {
		return ctx.JSON(415, map[string]string{"error": "only JPEG, PNG, WebP and GIF images are allowed"})
	}
	if _, err := src.Seek(0, io.SeekStart); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	// Build the target path: files/equipments/{eq}/interventions/{inv}/{uuid}{ext}.
	stored := randomName() + ext
	relDir := filestore.InterventionFilesRelDir(equipmentID, id)
	relPath := relDir + "/" + stored
	absDir := filestore.Abs(h.BaseDir, relDir)
	absPath := filepath.Join(absDir, stored)

	if err := os.MkdirAll(absDir, 0755); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	dst, err := os.Create(absPath)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	// Enforce the size cap again while streaming, so a lying header cannot
	// exceed it. +1 lets us detect an over-cap body.
	written, err := io.Copy(dst, io.LimitReader(src, filestore.MaxImageSize+1))
	dst.Close()
	if err != nil {
		os.Remove(absPath)
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	if written > filestore.MaxImageSize {
		os.Remove(absPath)
		return ctx.JSON(413, map[string]string{"error": "file exceeds the 10 MB limit"})
	}

	row := &models.InterventionFile{
		InterventionID: id,
		FilePath:       relPath,
		OriginalName:   fileHeader.Filename,
	}
	if err := dbpackage.CreateInterventionFile(h.DB, row); err != nil {
		os.Remove(absPath)
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	return ctx.JSON(201, h.interventionFileResponse(id, *row))
}

func (h *Handler) GetInterventionFile(ctx echo.Context, id int, filename string) error {
	_, equipmentID, err := h.resolveIntervention(ctx, id)
	if err != nil {
		return err
	}

	relPath := filestore.InterventionFilesRelDir(equipmentID, id) + "/" + filename
	row, err := dbpackage.GetInterventionFileByPath(h.DB, id, relPath)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "File not found"})
	}

	abs := filestore.Abs(h.BaseDir, row.FilePath)
	if _, err := os.Stat(abs); err != nil {
		return ctx.JSON(404, map[string]string{"error": "File not found"})
	}

	// Photos are served inline so they can be displayed in the browser.
	ctx.Response().Header().Set("Content-Type", detectMime(abs))
	ctx.Response().Header().Set("Content-Disposition", "inline")
	return ctx.File(abs)
}

func (h *Handler) DeleteInterventionFile(ctx echo.Context, id int, filename string) error {
	_, equipmentID, err := h.resolveIntervention(ctx, id)
	if err != nil {
		return err
	}

	relPath := filestore.InterventionFilesRelDir(equipmentID, id) + "/" + filename
	row, err := dbpackage.GetInterventionFileByPath(h.DB, id, relPath)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "File not found"})
	}

	if err := dbpackage.DeleteInterventionFile(h.DB, id, relPath); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	abs := filestore.Abs(h.BaseDir, row.FilePath)
	if err := os.Remove(abs); err != nil && !os.IsNotExist(err) {
		log.Printf("delete file %s: %v", abs, err)
	}

	return ctx.NoContent(204)
}

// removeInterventionFilesDir removes the on-disk directory holding one
// intervention's photos. Called when an intervention (or its parent task) is
// deleted, so the bytes do not linger after the DB rows are gone.
func (h *Handler) removeInterventionFilesDir(equipmentID, interventionID int) {
	dir := filestore.Abs(h.BaseDir, filestore.InterventionFilesRelDir(equipmentID, interventionID))
	if err := os.RemoveAll(dir); err != nil {
		log.Printf("remove intervention files dir %s: %v", dir, err)
	}
}
