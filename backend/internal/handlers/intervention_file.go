package handlers

import (
	"fmt"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/attachments"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/generated"
)

// photosOf names the photos of an intervention. Photos are addressed by
// intervention id alone; the equipment is needed only for where their bytes
// are kept. It reports false when the intervention is missing or has no owning
// equipment: the caller answers 404 (issue #92).
func (h *Handler) photosOf(interventionID int) (attachments.Owner, bool) {
	inv, err := dbpackage.GetIntervention(h.DB, interventionID)
	if err != nil || inv.EquipmentID == nil {
		return attachments.Owner{}, false
	}
	return attachments.InterventionPhotos(*inv.EquipmentID, interventionID), true
}

// interventionNotFound answers 404 for an intervention whose photos are asked
// for but which is missing or has no owning equipment.
func interventionNotFound(ctx echo.Context) error {
	return ctx.JSON(404, map[string]string{"error": "Intervention not found"})
}

// photosURL is the URL an intervention's photos are served under. It does not
// depend on the equipment, so it survives the intervention moving.
func photosURL(interventionID int) string {
	return fmt.Sprintf("/api/interventions/%d/files/", interventionID)
}

func (h *Handler) ListInterventionFiles(ctx echo.Context, id int) error {
	photos, ok := h.photosOf(id)
	if !ok {
		return interventionNotFound(ctx)
	}

	list, err := h.attachments().List(photos)
	if err != nil {
		return ctx.JSON(500, map[string]string{"error": err.Error()})
	}

	files := make([]generated.FileInfo, 0, len(list))
	for _, a := range list {
		files = append(files, fileInfo(photosURL(id), a))
	}
	return ctx.JSON(200, files)
}

func (h *Handler) UploadInterventionFile(ctx echo.Context, id int) error {
	photos, ok := h.photosOf(id)
	if !ok {
		return interventionNotFound(ctx)
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

	a, err := h.attachments().Add(photos, fileHeader.Filename, fileHeader.Size, src)
	if err != nil {
		return attachmentError(ctx, err)
	}
	return ctx.JSON(201, fileInfo(photosURL(id), a))
}

func (h *Handler) GetInterventionFile(ctx echo.Context, id int, filename string) error {
	photos, ok := h.photosOf(id)
	if !ok {
		return interventionNotFound(ctx)
	}
	return h.serveAttachment(ctx, photos, filename)
}

func (h *Handler) DeleteInterventionFile(ctx echo.Context, id int, filename string) error {
	photos, ok := h.photosOf(id)
	if !ok {
		return interventionNotFound(ctx)
	}
	if err := h.attachments().Delete(photos, filename); err != nil {
		return attachmentError(ctx, err)
	}
	return ctx.NoContent(204)
}
