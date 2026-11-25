// Package attachments owns the files users add to an equipment (documents)
// and to an intervention (photos): their rows in the attachment tables and
// their bytes under the files/ directory next to the database. No other
// package reads or writes either; see doc/file-storage.md and ADR 0004.
//
// It sits below package db and imports neither db nor the handlers. Anything
// that needs another table — whether an owner exists, which equipment an
// intervention belongs to — is the caller's to settle before naming an Owner.
package attachments

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/filestore"
)

// Kind describes one kind of attachment. The kinds differ only by data: their
// table, their directory, their cap, the types they allow and how they are
// served.
type Kind struct {
	table       string // attachment table
	ownerColumn string // the table's column holding the owner's id
	maxSize     int64  // largest accepted size, in bytes
	// types maps each allowed MIME type, sniffed from the leading bytes, to
	// the stored extension. Nil allows any type and keeps the extension of the
	// original name.
	types       map[string]string
	typeRefusal string // the reason given when the sniffed type is not allowed
	inline      bool   // served inline rather than downloaded
	// dir is the directory, relative to the base directory, holding the
	// attachments of one owner.
	dir func(equipmentID, ownerID int) string
}

// Document is a file attached to an equipment: any type, downloaded under its
// original name.
var Document = &Kind{
	table:       "equipment_files",
	ownerColumn: "equipment_id",
	maxSize:     filestore.MaxDocumentSize,
	inline:      false,
	dir: func(equipmentID, _ int) string {
		return equipmentDir(equipmentID) + "/files"
	},
}

// Photo is an image attached to an intervention, served inline so it can be
// displayed.
var Photo = &Kind{
	table:       "intervention_files",
	ownerColumn: "intervention_id",
	maxSize:     filestore.MaxImageSize,
	types: map[string]string{
		"image/jpeg": ".jpg",
		"image/png":  ".png",
		"image/webp": ".webp",
		"image/gif":  ".gif",
	},
	typeRefusal: "only JPEG, PNG, WebP and GIF images are allowed",
	inline:      true,
	dir: func(equipmentID, interventionID int) string {
		return equipmentDir(equipmentID) + "/interventions/" + strconv.Itoa(interventionID)
	},
}

// equipmentDir is the directory, relative to the base directory, holding
// everything attached under an equipment: its documents and the photos of its
// interventions.
func equipmentDir(equipmentID int) string {
	return "files/equipments/" + strconv.Itoa(equipmentID)
}

// tooLarge is the refusal for a file over the kind's cap. It is built from the
// cap, so the number in the message cannot drift from it.
func (k *Kind) tooLarge() error {
	return refusal{ErrTooLarge, fmt.Sprintf("file exceeds the %d MB limit", k.maxSize>>20)}
}

// disposition is the Content-Disposition a file of this kind is served with.
func (k *Kind) disposition(originalName string) string {
	if k.inline {
		return "inline"
	}
	return fmt.Sprintf("attachment; filename=%q", originalName)
}

// Owner names whose attachments a call is about: a kind and the id of the
// entity that owns them, plus the equipment their directory is kept under.
// The caller builds it once it has checked that the owner exists.
type Owner struct {
	kind        *Kind
	id          int
	equipmentID int
}

// EquipmentDocuments names the documents of an equipment.
func EquipmentDocuments(equipmentID int) Owner {
	return Owner{kind: Document, id: equipmentID, equipmentID: equipmentID}
}

// InterventionPhotos names the photos of an intervention, kept under the
// equipment it belongs to.
func InterventionPhotos(equipmentID, interventionID int) Owner {
	return Owner{kind: Photo, id: interventionID, equipmentID: equipmentID}
}

// dir is the directory holding the owner's attachments, relative to the base
// directory, e.g. files/equipments/12/interventions/42.
func (o Owner) dir() string {
	return o.kind.dir(o.equipmentID, o.id)
}

// path is the stored relative path of the owner's attachment named name.
func (o Owner) path(name string) string {
	return o.dir() + "/" + name
}

// Attachment is one attached file as callers see it.
type Attachment struct {
	Name         string // stored name, unique, used to address it
	OriginalName string // the name it was uploaded under
	Size         int64  // in bytes, read from disk; 0 when missing
	MimeType     string // sniffed from the file's leading bytes
	UploadedAt   time.Time
	Missing      bool // its row exists but its file is gone from disk
}

// Download is what serving an attachment needs.
type Download struct {
	Path        string // absolute path of the file on disk
	MimeType    string
	Disposition string // the Content-Disposition header value
}

var (
	// ErrTooLarge reports a file over its kind's cap.
	ErrTooLarge = errors.New("attachment too large")
	// ErrNotAllowed reports a file whose sniffed type its kind does not allow.
	ErrNotAllowed = errors.New("attachment type not allowed")
	// ErrNotFound reports an attachment with no row for its owner, or whose
	// file is gone from disk when it is to be served.
	ErrNotFound = errors.New("File not found")
)

// refusal is an upload refused for a reason the user can act on. Its message
// is that reason; errors.Is matches it against ErrTooLarge or ErrNotAllowed.
type refusal struct {
	kind   error
	reason string
}

func (r refusal) Error() string        { return r.reason }
func (r refusal) Is(target error) bool { return target == r.kind }
