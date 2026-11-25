package attachments

import (
	"bytes"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/vtellier/OpenMaintenance/internal/filestore"
)

// Store reads and writes the attachments of a database and of the files/
// directory under baseDir, the directory holding that database.
type Store struct {
	db      *sql.DB
	baseDir string
}

// New returns the store for the database db, whose files/ directory is under
// baseDir.
func New(db *sql.DB, baseDir string) *Store {
	return &Store{db: db, baseDir: baseDir}
}

// abs joins a stored relative path with the base directory.
func (s *Store) abs(relPath string) string {
	return filestore.Abs(s.baseDir, relPath)
}

// Add stores the file read from src as a new attachment of o, under the
// original name it was uploaded with. declaredSize is the size the upload
// announced; the cap is enforced on it first, then again while reading, so a
// lying announcement cannot exceed it. A refused or failed upload leaves no
// file and no row behind.
func (s *Store) Add(o Owner, originalName string, declaredSize int64, src io.Reader) (Attachment, error) {
	k := o.kind
	if declaredSize > k.maxSize {
		return Attachment{}, k.tooLarge()
	}

	ext := filepath.Ext(originalName)
	if k.types != nil {
		// Sniff the type from the leading bytes, never from the name, and
		// refuse it before anything is written.
		head := make([]byte, 512)
		n, _ := io.ReadFull(src, head)
		allowed, ok := k.types[http.DetectContentType(head[:n])]
		if !ok {
			return Attachment{}, refusal{ErrNotAllowed, k.typeRefusal}
		}
		ext = allowed
		src = io.MultiReader(bytes.NewReader(head[:n]), src)
	}

	name := randomName() + ext
	relPath := o.path(name)
	absPath := s.abs(relPath)

	if err := os.MkdirAll(filepath.Dir(absPath), 0755); err != nil {
		return Attachment{}, err
	}
	dst, err := os.Create(absPath)
	if err != nil {
		return Attachment{}, err
	}
	// +1 lets an over-cap body be told apart from one exactly at the cap.
	written, err := io.Copy(dst, io.LimitReader(src, k.maxSize+1))
	dst.Close()
	if err != nil {
		os.Remove(absPath)
		return Attachment{}, err
	}
	if written > k.maxSize {
		os.Remove(absPath)
		return Attachment{}, k.tooLarge()
	}

	uploadedAt := time.Now()
	if _, err := s.db.Exec(
		`INSERT INTO `+k.table+` (`+k.ownerColumn+`, file_path, original_name, uploaded_at)
		 VALUES (?, ?, ?, ?)`,
		o.id, relPath, originalName, uploadedAt,
	); err != nil {
		os.Remove(absPath)
		return Attachment{}, err
	}
	return s.attachment(relPath, originalName, uploadedAt), nil
}

// List returns the attachments of o, oldest upload first. An attachment whose
// file is gone from disk is kept and reported Missing.
func (s *Store) List(o Owner) ([]Attachment, error) {
	k := o.kind
	rows, err := s.db.Query(
		`SELECT file_path, original_name, uploaded_at FROM `+k.table+`
		 WHERE `+k.ownerColumn+` = ? ORDER BY uploaded_at`,
		o.id,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]Attachment, 0)
	for rows.Next() {
		var relPath, originalName string
		var uploadedAt time.Time
		if err := rows.Scan(&relPath, &originalName, &uploadedAt); err != nil {
			return nil, err
		}
		list = append(list, s.attachment(relPath, originalName, uploadedAt))
	}
	return list, rows.Err()
}

// Open returns what serving the attachment of o named name needs. It answers
// ErrNotFound when o has no such attachment or its file is gone from disk.
func (s *Store) Open(o Owner, name string) (Download, error) {
	relPath := o.path(name)
	originalName, err := s.originalName(o, relPath)
	if err != nil {
		return Download{}, ErrNotFound
	}
	abs := s.abs(relPath)
	if _, err := os.Stat(abs); err != nil {
		return Download{}, ErrNotFound
	}
	return Download{
		Path:        abs,
		MimeType:    detectMime(abs),
		Disposition: o.kind.disposition(originalName),
	}, nil
}

// Delete removes the attachment of o named name: its row, then its file. It
// answers ErrNotFound when o has no such attachment. A file already gone from
// disk is not an error, and a file that cannot be removed is only logged: the
// row is gone, so the attachment is.
func (s *Store) Delete(o Owner, name string) error {
	k := o.kind
	relPath := o.path(name)
	if _, err := s.originalName(o, relPath); err != nil {
		return ErrNotFound
	}
	if _, err := s.db.Exec(
		`DELETE FROM `+k.table+` WHERE `+k.ownerColumn+` = ? AND file_path = ?`,
		o.id, relPath,
	); err != nil {
		return err
	}
	abs := s.abs(relPath)
	if err := os.Remove(abs); err != nil && !errors.Is(err, fs.ErrNotExist) {
		log.Printf("delete file %s: %v", abs, err)
	}
	return nil
}

// Count returns the number of attachments of kind k owned by ownerID.
func (s *Store) Count(k *Kind, ownerID int) (int, error) {
	var n int
	err := s.db.QueryRow(
		`SELECT COUNT(*) FROM `+k.table+` WHERE `+k.ownerColumn+` = ?`, ownerID,
	).Scan(&n)
	return n, err
}

// CountByOwner returns the number of attachments of kind k keyed by owner id,
// in one query. Owners with none are absent.
func (s *Store) CountByOwner(k *Kind) (map[int]int, error) {
	rows, err := s.db.Query(
		`SELECT ` + k.ownerColumn + `, COUNT(*) FROM ` + k.table + ` GROUP BY ` + k.ownerColumn,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[int]int)
	for rows.Next() {
		var id, n int
		if err := rows.Scan(&id, &n); err != nil {
			return nil, err
		}
		counts[id] = n
	}
	return counts, rows.Err()
}

// originalName looks up the original name of the attachment of o stored at
// relPath. Its error is sql.ErrNoRows when o has no such attachment.
func (s *Store) originalName(o Owner, relPath string) (string, error) {
	k := o.kind
	var name string
	err := s.db.QueryRow(
		`SELECT original_name FROM `+k.table+` WHERE `+k.ownerColumn+` = ? AND file_path = ?`,
		o.id, relPath,
	).Scan(&name)
	return name, err
}

// attachment builds the Attachment stored at relPath, reading its size and
// type from disk.
func (s *Store) attachment(relPath, originalName string, uploadedAt time.Time) Attachment {
	abs := s.abs(relPath)
	size, missing := statFile(abs)
	return Attachment{
		Name:         filepath.Base(relPath),
		OriginalName: originalName,
		Size:         size,
		MimeType:     detectMime(abs),
		UploadedAt:   uploadedAt,
		Missing:      missing,
	}
}

// statFile returns the size of the file at abs, and whether it is missing from
// disk (issue #122).
func statFile(abs string) (size int64, missing bool) {
	info, err := os.Stat(abs)
	if errors.Is(err, fs.ErrNotExist) {
		return 0, true
	}
	if err != nil {
		return 0, false
	}
	return info.Size(), false
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

// randomName returns a fresh name for a stored file: 32 hex characters.
func randomName() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand failure is effectively impossible.
		return "file"
	}
	return hex.EncodeToString(b)
}
