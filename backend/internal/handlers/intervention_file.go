package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"path"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/attachments"
	dbpackage "github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/filestore"
	"github.com/vtellier/OpenMaintenance/internal/generated"
	"github.com/vtellier/OpenMaintenance/internal/models"
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

// removeInterventionFilesDir removes the on-disk directory holding one
// intervention's photos. Called when an intervention (or its parent task) is
// deleted, so the bytes do not linger after the DB rows are gone.
func (h *Handler) removeInterventionFilesDir(equipmentID, interventionID int) {
	dir := filestore.Abs(h.BaseDir, filestore.InterventionFilesRelDir(equipmentID, interventionID))
	if err := os.RemoveAll(dir); err != nil {
		log.Printf("remove intervention files dir %s: %v", dir, err)
	}
}

// saveInterventionMovingPhotos saves an edited intervention. When the edit
// moves it to another equipment, its photos move with it: their on-disk
// location and stored file_path are keyed by the owning equipment
// (files/equipments/{eq}/interventions/{id}/), although their URLs are not.
//
// Files and DB rows cannot change in one transaction, so the steps are ordered
// to never leave a DB row pointing at a missing file, even after a crash:
//  1. copy each photo into the new equipment's directory (flushed to disk);
//  2. in one DB transaction, save the intervention and point its photo rows
//     at the copies;
//  3. only then delete the originals.
//
// If step 1 or 2 fails, the copies are removed and the edit is rejected, so
// the intervention and its photos stay where they were. A crash or a failed
// delete can only leave unreferenced files behind (the copies before step 2,
// the originals after it), never a dangling row.
func (h *Handler) saveInterventionMovingPhotos(inv *models.Intervention) error {
	before, err := dbpackage.GetIntervention(h.DB, inv.ID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		// Without the current equipment we cannot tell whether photos must
		// move; saving anyway could strand them.
		return err
	}
	if err != nil || before.EquipmentID == nil || inv.EquipmentID == nil ||
		*before.EquipmentID == *inv.EquipmentID {
		return dbpackage.UpdateIntervention(h.DB, inv)
	}

	photos, err := dbpackage.ListInterventionFiles(h.DB, inv.ID)
	if err != nil {
		return err
	}

	// 1. Copy.
	newDir := filestore.InterventionFilesRelDir(*inv.EquipmentID, inv.ID)
	newPaths := make(map[string]string, len(photos))
	var copies []string
	removeCopies := func() {
		for _, c := range copies {
			os.Remove(c)
		}
		os.Remove(filestore.Abs(h.BaseDir, newDir)) // only succeeds if left empty
	}
	for _, p := range photos {
		newPath := newDir + "/" + path.Base(p.FilePath)
		if newPath == p.FilePath {
			continue // already in place; copying onto itself would truncate it
		}
		src := filestore.Abs(h.BaseDir, p.FilePath)
		if _, err := os.Stat(src); os.IsNotExist(err) {
			// Already gone from disk: nothing to copy, but the row still
			// follows the intervention so it can be deleted through the API.
			// Any other stat error is left to CopyFile, which reports it.
			newPaths[p.FilePath] = newPath
			continue
		}
		dst := filestore.Abs(h.BaseDir, newPath)
		if err := filestore.CopyFile(src, dst); err != nil {
			removeCopies()
			return fmt.Errorf("move photos to the new equipment: %w", err)
		}
		copies = append(copies, dst)
		newPaths[p.FilePath] = newPath
	}

	// 2. Commit.
	if err := dbpackage.UpdateInterventionWithFilePaths(h.DB, inv, newPaths); err != nil {
		removeCopies()
		return err
	}

	// 3. Delete the originals, then the old directory if that emptied it.
	for oldPath := range newPaths {
		abs := filestore.Abs(h.BaseDir, oldPath)
		if err := os.Remove(abs); err != nil && !os.IsNotExist(err) {
			log.Printf("remove moved photo %s: %v", abs, err)
		}
	}
	os.Remove(filestore.Abs(h.BaseDir, filestore.InterventionFilesRelDir(*before.EquipmentID, inv.ID)))
	return nil
}
