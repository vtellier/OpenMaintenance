package attachments

import (
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

// newTestStore returns a store over a fresh database holding the documents
// table. The table mirrors its migration in package db, which this package
// cannot import (db imports it).
func newTestStore(t *testing.T) *Store {
	t.Helper()
	dir := t.TempDir()
	database, err := sql.Open("sqlite3", filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	if _, err := database.Exec(`CREATE TABLE equipment_files (
		equipment_id INTEGER NOT NULL,
		file_path TEXT PRIMARY KEY,
		original_name TEXT NOT NULL,
		uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		t.Fatalf("create table: %v", err)
	}
	return New(database, dir)
}

// assertNothingStored fails unless o has no row and no file on disk.
func assertNothingStored(t *testing.T, s *Store, o Owner) {
	t.Helper()
	list, err := s.List(o)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected no attachment row, got %+v", list)
	}
	entries, err := os.ReadDir(s.abs(o.dir()))
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("read dir: %v", err)
	}
	for _, e := range entries {
		t.Errorf("expected no file on disk, found %s", e.Name())
	}
}

// failingFile is a real stored file whose Sync or Close reports an error.
// Close still closes the file, so Add can remove it.
type failingFile struct {
	*os.File
	syncErr, closeErr error
}

func (f failingFile) Sync() error {
	if f.syncErr != nil {
		return f.syncErr
	}
	return f.File.Sync()
}

func (f failingFile) Close() error {
	err := f.File.Close()
	if f.closeErr != nil {
		return f.closeErr
	}
	return err
}

// Issue #138: a failed sync or close of the stored file left a row pointing at
// a possibly truncated file.
func TestAdd_FailedSyncOrCloseStoresNothing(t *testing.T) {
	errDisk := errors.New("no space left on device")
	cases := []struct {
		name string
		file func(*os.File) storedFile
	}{
		{"sync fails", func(f *os.File) storedFile { return failingFile{File: f, syncErr: errDisk} }},
		{"close fails", func(f *os.File) storedFile { return failingFile{File: f, closeErr: errDisk} }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := newTestStore(t)
			orig := createFile
			createFile = func(name string) (storedFile, error) {
				f, err := os.Create(name)
				if err != nil {
					return nil, err
				}
				return tc.file(f), nil
			}
			t.Cleanup(func() { createFile = orig })

			o := EquipmentDocuments(1)
			_, err := s.Add(o, "manual.pdf", 5, strings.NewReader("hello"))
			if !errors.Is(err, errDisk) {
				t.Fatalf("expected the disk error, got %v", err)
			}
			assertNothingStored(t, s, o)
		})
	}
}

// failingReader is a random source that cannot be read.
type failingReader struct{ err error }

func (r failingReader) Read([]byte) (int, error) { return 0, r.err }

// Issue #138: when crypto/rand failed, every upload was stored as "file", so
// two uploads could share a name.
func TestAdd_NoRandomnessStoresNothing(t *testing.T) {
	s := newTestStore(t)
	errRand := errors.New("entropy unavailable")
	orig := randSource
	randSource = failingReader{errRand}
	t.Cleanup(func() { randSource = orig })

	o := EquipmentDocuments(1)
	_, err := s.Add(o, "manual.pdf", 5, strings.NewReader("hello"))
	if !errors.Is(err, errRand) {
		t.Fatalf("expected the random source's error, got %v", err)
	}
	assertNothingStored(t, s, o)
}
