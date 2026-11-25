package handlers

import (
	"errors"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/attachments"
	"github.com/vtellier/OpenMaintenance/internal/generated"
)

// attachments returns the store for the handler's database and files/ tree.
func (h *Handler) attachments() *attachments.Store {
	return attachments.New(h.DB, h.BaseDir)
}

// fileInfo builds the API File object for an attachment served under
// urlPrefix (the owner's files URL, ending in a slash).
func fileInfo(urlPrefix string, a attachments.Attachment) generated.FileInfo {
	return generated.FileInfo{
		Name:         a.Name,
		OriginalName: a.OriginalName,
		Size:         a.Size,
		MimeType:     a.MimeType,
		UploadedAt:   a.UploadedAt,
		Url:          urlPrefix + a.Name,
		Missing:      a.Missing,
	}
}

// attachmentError answers an error from the attachments store: a refusal with
// its reason (413 too large, 415 type not allowed), 404 for an unknown
// attachment, 500 otherwise.
func attachmentError(ctx echo.Context, err error) error {
	status := 500
	switch {
	case errors.Is(err, attachments.ErrTooLarge):
		status = 413
	case errors.Is(err, attachments.ErrNotAllowed):
		status = 415
	case errors.Is(err, attachments.ErrNotFound):
		status = 404
	}
	return ctx.JSON(status, map[string]string{"error": err.Error()})
}

// serveAttachment streams the attachment of o named name.
func (h *Handler) serveAttachment(ctx echo.Context, o attachments.Owner, name string) error {
	d, err := h.attachments().Open(o, name)
	if err != nil {
		return attachmentError(ctx, err)
	}
	ctx.Response().Header().Set("Content-Type", d.MimeType)
	ctx.Response().Header().Set("Content-Disposition", d.Disposition)
	return ctx.File(d.Path)
}
