package handlers

import (
	"crypto/rand"
	"encoding/hex"
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

// fileResponse builds the API File object for a stored document, reading size
// and MIME type from disk.
func (h *Handler) fileResponse(equipmentID int, f models.EquipmentFile) generated.File {
	name := filepath.Base(f.FilePath)
	abs := filestore.Abs(h.BaseDir, f.FilePath)

	var size int64
	if info, err := os.Stat(abs); err == nil {
		size = info.Size()
	}

	mimeType := detectMime(abs)

	return generated.File{
		Name:         name,
		OriginalName: f.OriginalName,
		Size:         size,
		MimeType:     mimeType,
		UploadedAt:   f.UploadedAt,
		Url:          fmt.Sprintf("/api/equipments/%d/files/%s", equipmentID, name),
	}
}

// detectMime sniffs the MIME type from the file's leading bytes, falling back
// to application/octet-stream.
func detectMime(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return "application/octet-stream"
	}
	defer f.Close()
	buf := make([]byte, 512)
	n, _ := f.Read(buf)
	return http.DetectContentType(buf[:n])
}

func (h *Handler) ListEquipmentFiles(ctx echo.Context, equipmentId int) error {
	if _, err := dbpackage.GetEquipment(h.DB, equipmentId); err != nil {
		return ctx.JSON(404, map[string]string{"error": "Equipment not found"})
	}

	rows, err := dbpackage.ListEquipmentFiles(h.DB, equipmentId)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	files := make([]generated.File, 0, len(rows))
	for _, r := range rows {
		files = append(files, h.fileResponse(equipmentId, r))
	}
	return ctx.JSON(200, files)
}

func (h *Handler) UploadEquipmentFile(ctx echo.Context, equipmentId int) error {
	if _, err := dbpackage.GetEquipment(h.DB, equipmentId); err != nil {
		return ctx.JSON(404, map[string]string{"error": "Equipment not found"})
	}

	fileHeader, err := ctx.FormFile("file")
	if err != nil {
		return ctx.JSON(400, map[string]string{"error": "missing file"})
	}
	if fileHeader.Size > filestore.MaxDocumentSize {
		return ctx.JSON(413, map[string]string{"error": "file exceeds the 25 MB limit"})
	}

	src, err := fileHeader.Open()
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	defer src.Close()

	// Build the target path: files/equipments/{id}/files/{uuid}{ext}.
	ext := filepath.Ext(fileHeader.Filename)
	stored := randomName() + ext
	relDir := filestore.EquipmentFilesRelDir(equipmentId)
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
	written, err := io.Copy(dst, io.LimitReader(src, filestore.MaxDocumentSize+1))
	dst.Close()
	if err != nil {
		os.Remove(absPath)
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	if written > filestore.MaxDocumentSize {
		os.Remove(absPath)
		return ctx.JSON(413, map[string]string{"error": "file exceeds the 25 MB limit"})
	}

	row := &models.EquipmentFile{
		EquipmentID:  equipmentId,
		FilePath:     relPath,
		OriginalName: fileHeader.Filename,
	}
	if err := dbpackage.CreateEquipmentFile(h.DB, row); err != nil {
		os.Remove(absPath)
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	return ctx.JSON(201, h.fileResponse(equipmentId, *row))
}

func (h *Handler) GetEquipmentFile(ctx echo.Context, equipmentId int, filename string) error {
	relPath := filestore.EquipmentFilesRelDir(equipmentId) + "/" + filename
	row, err := dbpackage.GetEquipmentFileByPath(h.DB, equipmentId, relPath)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "File not found"})
	}

	abs := filestore.Abs(h.BaseDir, row.FilePath)
	if _, err := os.Stat(abs); err != nil {
		return ctx.JSON(404, map[string]string{"error": "File not found"})
	}

	ctx.Response().Header().Set("Content-Type", detectMime(abs))
	ctx.Response().Header().Set("Content-Disposition",
		fmt.Sprintf("attachment; filename=%q", row.OriginalName))
	return ctx.File(abs)
}

func (h *Handler) DeleteEquipmentFile(ctx echo.Context, equipmentId int, filename string) error {
	relPath := filestore.EquipmentFilesRelDir(equipmentId) + "/" + filename
	row, err := dbpackage.GetEquipmentFileByPath(h.DB, equipmentId, relPath)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "File not found"})
	}

	if err := dbpackage.DeleteEquipmentFile(h.DB, equipmentId, relPath); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	abs := filestore.Abs(h.BaseDir, row.FilePath)
	if err := os.Remove(abs); err != nil && !os.IsNotExist(err) {
		log.Printf("delete file %s: %v", abs, err)
	}

	return ctx.NoContent(204)
}

// DeleteEquipmentFiles removes the entire on-disk directory tree for an
// equipment. Called by DeleteEquipment after the DB rows are gone.
func (h *Handler) removeEquipmentFilesDir(equipmentID int) {
	dir := filestore.Abs(h.BaseDir, filestore.EquipmentRelDir(equipmentID))
	if err := os.RemoveAll(dir); err != nil {
		log.Printf("remove equipment files dir %s: %v", dir, err)
	}
}

func randomName() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand failure is effectively impossible; fall back to a
		// timestamp-free deterministic-ish name only as a last resort.
		return "file"
	}
	return hex.EncodeToString(b)
}
