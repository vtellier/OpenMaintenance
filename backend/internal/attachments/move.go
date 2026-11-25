package attachments

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"path"
	"path/filepath"
)

// ErrChangedDuringMove reports that the attachments being moved changed (a
// concurrent move or delete) between the time Move read them and its commit.
var ErrChangedDuringMove = errors.New("the intervention's photos changed during the move; try again")

// Move moves the attachments of o under another equipment, as when an
// intervention is edited to belong to another equipment: their location on
// disk is keyed by the equipment, although their URLs are not. save is the
// caller's save of the owner; it runs in the transaction that rewrites the
// attachments' paths, so the owner and its rows never disagree.
//
// Files and rows cannot change in one transaction, so the steps are ordered to
// never leave a row pointing at a missing file, even after a crash:
//  1. copy each file under the new equipment, flushed to disk;
//  2. in one transaction, run save, then point the rows at the copies;
//  3. only then delete the originals.
//
// If step 1 or 2 fails, the copies are removed and nothing is saved; when the
// rows changed meanwhile, the error is ErrChangedDuringMove. A crash or a
// failed delete can only leave unreferenced files behind (the copies before
// step 2, the originals after it), never a dangling row.
func (s *Store) Move(o Owner, equipmentID int, save func(tx *sql.Tx) error) error {
	to := Owner{kind: o.kind, id: o.id, equipmentID: equipmentID}
	paths, err := s.paths(o)
	if err != nil {
		return err
	}

	// 1. Copy.
	newPaths := make(map[string]string, len(paths))
	var copies []string
	removeCopies := func() {
		for _, c := range copies {
			os.Remove(c)
		}
		os.Remove(s.abs(to.dir())) // only succeeds if left empty
	}
	for _, oldPath := range paths {
		newPath := to.path(path.Base(oldPath))
		if newPath == oldPath {
			continue // already in place; copying onto itself would truncate it
		}
		src := s.abs(oldPath)
		if _, err := os.Stat(src); errors.Is(err, fs.ErrNotExist) {
			// Already gone from disk: nothing to copy, but the row still
			// follows its owner so it can be deleted through the API. Any
			// other stat error is left to copyFile, which reports it.
			newPaths[oldPath] = newPath
			continue
		}
		dst := s.abs(newPath)
		if err := copyFile(src, dst); err != nil {
			removeCopies()
			return fmt.Errorf("move photos to the new equipment: %w", err)
		}
		copies = append(copies, dst)
		newPaths[oldPath] = newPath
	}

	// 2. Commit.
	if err := s.commitMove(o, newPaths, save); err != nil {
		removeCopies()
		return err
	}

	// 3. Delete the originals, then the old directory if that emptied it.
	for oldPath := range newPaths {
		abs := s.abs(oldPath)
		if err := os.Remove(abs); err != nil && !errors.Is(err, fs.ErrNotExist) {
			log.Printf("remove moved attachment %s: %v", abs, err)
		}
	}
	os.Remove(s.abs(o.dir()))
	return nil
}

// commitMove runs save, then rewrites the paths of o's rows (old path -> new
// path), in one transaction. Every old path must still match a row.
func (s *Store) commitMove(o Owner, newPaths map[string]string, save func(tx *sql.Tx) error) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() // no-op once committed

	if err := save(tx); err != nil {
		return err
	}
	k := o.kind
	for oldPath, newPath := range newPaths {
		res, err := tx.Exec(
			`UPDATE `+k.table+` SET file_path = ? WHERE `+k.ownerColumn+` = ? AND file_path = ?`,
			newPath, o.id, oldPath,
		)
		if err != nil {
			return err
		}
		if n, err := res.RowsAffected(); err != nil {
			return err
		} else if n != 1 {
			return ErrChangedDuringMove
		}
	}
	return tx.Commit()
}

// paths returns the stored paths of o's attachments.
func (s *Store) paths(o Owner) ([]string, error) {
	rows, err := s.db.Query(
		`SELECT file_path FROM `+o.kind.table+` WHERE `+o.kind.ownerColumn+` = ?`, o.id,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		paths = append(paths, p)
	}
	return paths, rows.Err()
}

// copyFile copies src to dst, creating dst's directory if needed. The copy is
// flushed to disk before returning, so a row committed to point at it
// afterwards never references a file lost in a crash. A partial copy is
// removed on failure.
func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	_, err = io.Copy(out, in)
	if err == nil {
		err = out.Sync()
	}
	if cerr := out.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		os.Remove(dst)
	}
	return err
}
