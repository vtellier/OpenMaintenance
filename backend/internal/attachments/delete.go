package attachments

import (
	"database/sql"
	"log"
	"os"
)

// Execer runs a statement: the database, or the transaction (*sql.Tx) a caller
// deletes an owner in, so the owner's attachment rows go in the same commit.
type Execer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

// DeleteAll deletes, through ex, the rows of every attachment of the owners,
// and returns the removal of their directories from disk. The caller runs
// removeFiles once the deletion is committed: a file may outlive its row (an
// orphan, which startup cleanup recovers), a row must never outlive its file.
func (s *Store) DeleteAll(ex Execer, owners ...Owner) (removeFiles func(), err error) {
	dirs := make([]string, 0, len(owners))
	for _, o := range owners {
		if err := deleteRows(ex, o); err != nil {
			return nil, err
		}
		dirs = append(dirs, o.dir())
	}
	return s.removal(dirs), nil
}

// DeleteEquipment deletes, through ex, the rows of every attachment kept under
// the equipment: its documents, and the photos of its interventions, whose ids
// the caller gives (the module does not read the interventions table). Its
// removeFiles removes the equipment's whole directory, files no row
// references included; run it as DeleteAll's.
func (s *Store) DeleteEquipment(ex Execer, equipmentID int, interventionIDs []int) (removeFiles func(), err error) {
	owners := []Owner{EquipmentDocuments(equipmentID)}
	for _, id := range interventionIDs {
		owners = append(owners, InterventionPhotos(equipmentID, id))
	}
	for _, o := range owners {
		if err := deleteRows(ex, o); err != nil {
			return nil, err
		}
	}
	return s.removal([]string{equipmentDir(equipmentID)}), nil
}

// deleteRows deletes the rows of every attachment of o.
func deleteRows(ex Execer, o Owner) error {
	_, err := ex.Exec(`DELETE FROM `+o.kind.table+` WHERE `+o.kind.ownerColumn+` = ?`, o.id)
	return err
}

// removal returns the removal of the directories (relative to the base
// directory) and everything under them. A failure is only logged: the rows are
// gone, so what is left is an orphan.
func (s *Store) removal(dirs []string) func() {
	return func() {
		for _, d := range dirs {
			abs := s.abs(d)
			if err := os.RemoveAll(abs); err != nil {
				log.Printf("remove attachments dir %s: %v", abs, err)
			}
		}
	}
}
