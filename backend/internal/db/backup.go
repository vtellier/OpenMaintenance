package db

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type BackupConfig struct {
	Enabled bool
	Path    string
	Keep    int
}

// BackupDB copies dbPath into cfg.Path before the DB is opened. It must be
// called before sql.Open so the copy captures a fully consistent file.
// Does nothing when backup is disabled or the DB file does not yet exist.
func BackupDB(dbPath string, cfg BackupConfig) error {
	if !cfg.Enabled {
		return nil
	}
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		return nil // first run, nothing to back up
	}

	backupDir := cfg.Path
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return fmt.Errorf("backup: cannot create backup directory: %w", err)
	}

	base := filepath.Base(dbPath)
	stem := strings.TrimSuffix(base, filepath.Ext(base))
	ts := time.Now().Format("20060102-150405")
	backupName := fmt.Sprintf("%s.%s.bak", stem, ts)
	backupPath := filepath.Join(backupDir, backupName)

	if err := copyFile(dbPath, backupPath); err != nil {
		return fmt.Errorf("backup: copy failed: %w", err)
	}

	if cfg.Keep > 0 {
		if err := rotate(backupDir, stem, cfg.Keep); err != nil {
			return fmt.Errorf("backup: rotation failed: %w", err)
		}
	}

	log.Printf("backup created: %s", backupPath)
	return nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func rotate(dir, stem string, keep int) error {
	pattern := filepath.Join(dir, stem+".*.bak")
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return err
	}
	sort.Strings(matches) // lexicographic == chronological for our timestamp format
	for len(matches) > keep {
		if err := os.Remove(matches[0]); err != nil {
			return err
		}
		matches = matches[1:]
	}
	return nil
}
