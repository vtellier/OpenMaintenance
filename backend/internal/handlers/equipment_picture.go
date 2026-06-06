package handlers

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/labstack/echo/v4"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/filestore"
	"github.com/vtellier/OpenMaintenance/internal/generated"
)

// equipmentPictureResponse builds a FileInfo for an equipment's profile
// picture, reading size and modification time from disk.
func (h *Handler) equipmentPictureResponse(id int, relPath string) generated.FileInfo {
	abs := filestore.Abs(h.BaseDir, relPath)

	var size int64
	uploadedAt := time.Now()
	if info, err := os.Stat(abs); err == nil {
		size = info.Size()
		uploadedAt = info.ModTime()
	}

	name := filepath.Base(relPath)
	return generated.FileInfo{
		Name:         name,
		OriginalName: name,
		Size:         size,
		MimeType:     detectMime(abs),
		UploadedAt:   uploadedAt,
		Url:          fmt.Sprintf("/api/equipments/%d/picture", id),
	}
}

func (h *Handler) UploadEquipmentPicture(ctx echo.Context, id int) error {
	eq, err := dbpackage.GetEquipment(h.DB, id)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "Equipment not found"})
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

	// One picture per equipment, stored at a fixed name: picture.{ext}.
	relPath := filestore.EquipmentPictureRelPath(id, ext)
	absDir := filestore.Abs(h.BaseDir, filestore.EquipmentRelDir(id))
	absPath := filestore.Abs(h.BaseDir, relPath)

	if err := os.MkdirAll(absDir, 0755); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	// If a previous picture exists with a different extension, its file would
	// otherwise be orphaned — remove it before writing the new one.
	if eq.Picture != nil && *eq.Picture != relPath {
		old := filestore.Abs(h.BaseDir, *eq.Picture)
		if err := os.Remove(old); err != nil && !os.IsNotExist(err) {
			log.Printf("remove old picture %s: %v", old, err)
		}
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

	if err := dbpackage.UpdateEquipmentPicture(h.DB, id, &relPath); err != nil {
		os.Remove(absPath)
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	return ctx.JSON(200, h.equipmentPictureResponse(id, relPath))
}

func (h *Handler) GetEquipmentPicture(ctx echo.Context, id int) error {
	eq, err := dbpackage.GetEquipment(h.DB, id)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "Equipment not found"})
	}
	if eq.Picture == nil {
		return ctx.JSON(404, map[string]string{"error": "No picture set"})
	}

	abs := filestore.Abs(h.BaseDir, *eq.Picture)
	if _, err := os.Stat(abs); err != nil {
		return ctx.JSON(404, map[string]string{"error": "No picture set"})
	}

	// Served inline so it can be displayed in the browser.
	ctx.Response().Header().Set("Content-Type", detectMime(abs))
	ctx.Response().Header().Set("Content-Disposition", "inline")
	return ctx.File(abs)
}

func (h *Handler) DeleteEquipmentPicture(ctx echo.Context, id int) error {
	eq, err := dbpackage.GetEquipment(h.DB, id)
	if err != nil {
		return ctx.JSON(404, map[string]string{"error": "Equipment not found"})
	}
	if eq.Picture == nil {
		return ctx.NoContent(204) // already absent — idempotent
	}

	abs := filestore.Abs(h.BaseDir, *eq.Picture)
	if err := dbpackage.UpdateEquipmentPicture(h.DB, id, nil); err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	if err := os.Remove(abs); err != nil && !os.IsNotExist(err) {
		log.Printf("delete picture %s: %v", abs, err)
	}

	return ctx.NoContent(204)
}
