package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/db"
	"github.com/vtellier/OpenMaintenance/internal/generated"
	"github.com/vtellier/OpenMaintenance/internal/handlers"
	"github.com/vtellier/OpenMaintenance/internal/models"
)

// backend is the real API on a fresh temp DB, served over HTTP on a random
// port, counting the POST requests it receives.
type backend struct {
	url   string
	h     *handlers.Handler
	posts atomic.Int64
}

func newBackend(t *testing.T) *backend {
	t.Helper()
	dir := t.TempDir()
	database, err := db.InitDB(filepath.Join(dir, "maintenance.db"), "test", db.BackupConfig{Enabled: false})
	if err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	b := &backend{h: &handlers.Handler{DB: database, Version: "test", BaseDir: dir}}
	e := echo.New()
	generated.RegisterHandlersWithBaseURL(e, b.h, "/api")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			b.posts.Add(1)
		}
		e.ServeHTTP(w, r)
	}))
	t.Cleanup(srv.Close)
	b.url = srv.URL
	return b
}

func (b *backend) count(t *testing.T, path string) int {
	t.Helper()
	resp, err := http.Get(b.url + path)
	if err != nil {
		t.Fatalf("GET %s: %v", path, err)
	}
	defer resp.Body.Close()
	var items []json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		t.Fatalf("decode %s: %v", path, err)
	}
	return len(items)
}

// Issue #140: on an empty database, the seeder creates the whole demo dataset.
func TestRun_EmptyDatabase_SeedsDemoData(t *testing.T) {
	b := newBackend(t)

	if err := run(b.url, http.DefaultClient, io.Discard); err != nil {
		t.Fatalf("run on an empty database: %v", err)
	}
	if got := b.count(t, "/api/equipments"); got != 6 {
		t.Errorf("equipments = %d, want 6", got)
	}
	if got := b.count(t, "/api/groups"); got != 1 {
		t.Errorf("groups = %d, want 1", got)
	}
}

// Issue #140: on a database that already holds data, the seeder refuses
// before it creates anything.
func TestRun_DatabaseHoldsData_RefusesBeforeCreating(t *testing.T) {
	tests := []struct {
		name  string
		setup func(t *testing.T, b *backend)
		want  string
	}{
		{
			name: "already seeded",
			setup: func(t *testing.T, b *backend) {
				if err := run(b.url, http.DefaultClient, io.Discard); err != nil {
					t.Fatalf("first run: %v", err)
				}
			},
			want: "6 equipments, 1 group",
		},
		{
			name: "only a group",
			setup: func(t *testing.T, b *backend) {
				if err := db.CreateGroup(b.h.DB, &models.Group{Name: "Bikes"}); err != nil {
					t.Fatalf("CreateGroup: %v", err)
				}
			},
			want: "0 equipments, 1 group",
		},
		{
			name: "only an equipment",
			setup: func(t *testing.T, b *backend) {
				if err := db.CreateEquipment(b.h.DB, &models.Equipment{Name: "Lawn mower"}); err != nil {
					t.Fatalf("CreateEquipment: %v", err)
				}
			},
			want: "1 equipment, 0 groups",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := newBackend(t)
			tt.setup(t, b)
			equipments, groups := b.count(t, "/api/equipments"), b.count(t, "/api/groups")
			postsBefore := b.posts.Load()

			err := run(b.url, http.DefaultClient, io.Discard)

			if err == nil {
				t.Fatal("run on a database that holds data: got no error, want a refusal")
			}
			for _, part := range []string{"already holds data", tt.want, "empty database"} {
				if !strings.Contains(err.Error(), part) {
					t.Errorf("error %q does not mention %q", err, part)
				}
			}
			if sent := b.posts.Load() - postsBefore; sent != 0 {
				t.Errorf("run sent %d POST requests, want 0", sent)
			}
			if got := b.count(t, "/api/equipments"); got != equipments {
				t.Errorf("equipments = %d after the refusal, want %d", got, equipments)
			}
			if got := b.count(t, "/api/groups"); got != groups {
				t.Errorf("groups = %d after the refusal, want %d", got, groups)
			}
		})
	}
}
