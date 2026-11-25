package handlers

import (
	"fmt"
	"log"
	"os"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/attachments"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/filestore"
	"github.com/vtellier/OpenMaintenance/internal/generated"
)

// documentsURL is the URL an equipment's documents are served under.
func documentsURL(equipmentID int) string {
	return fmt.Sprintf("/api/equipments/%d/files/", equipmentID)
}

func (h *Handler) ListEquipmentFiles(ctx echo.Context, equipmentId int) error {
	if _, err := dbpackage.GetEquipment(h.DB, equipmentId); err != nil {
		return ctx.JSON(404, map[string]string{"error": "Equipment not found"})
	}

	list, err := h.attachments().List(attachments.EquipmentDocuments(equipmentId))
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	files := make([]generated.FileInfo, 0, len(list))
	for _, a := range list {
		files = append(files, fileInfo(documentsURL(equipmentId), a))
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
	src, err := fileHeader.Open()
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}
	defer src.Close()

	a, err := h.attachments().Add(attachments.EquipmentDocuments(equipmentId),
		fileHeader.Filename, fileHeader.Size, src)
	if err != nil {
		return attachmentError(ctx, err)
	}
	return ctx.JSON(201, fileInfo(documentsURL(equipmentId), a))
}

func (h *Handler) GetEquipmentFile(ctx echo.Context, equipmentId int, filename string) error {
	return h.serveAttachment(ctx, attachments.EquipmentDocuments(equipmentId), filename)
}

func (h *Handler) DeleteEquipmentFile(ctx echo.Context, equipmentId int, filename string) error {
	if err := h.attachments().Delete(attachments.EquipmentDocuments(equipmentId), filename); err != nil {
		return attachmentError(ctx, err)
	}
	return ctx.NoContent(204)
}

// removeEquipmentFilesDir removes the entire on-disk directory tree for an
// equipment. Called by DeleteEquipment after the DB rows are gone.
func (h *Handler) removeEquipmentFilesDir(equipmentID int) {
	dir := filestore.Abs(h.BaseDir, filestore.EquipmentRelDir(equipmentID))
	if err := os.RemoveAll(dir); err != nil {
		log.Printf("remove equipment files dir %s: %v", dir, err)
	}
}
