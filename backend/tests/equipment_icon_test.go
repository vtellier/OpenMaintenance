package tests

import (
	"testing"

	"github.com/vtellier/OpenMaintenance/internal/db"
)

func TestEquipment_IconDefaultsAndUpdates(t *testing.T) {
	_, h, _ := newTestServer(t)
	id := seedEquipment(t, h)

	// Default icon on create.
	eq, err := db.GetEquipment(h.DB, id)
	if err != nil {
		t.Fatalf("GetEquipment: %v", err)
	}
	if eq.Icon != "🔧" {
		t.Errorf("default icon = %q, want 🔧", eq.Icon)
	}

	// Custom icon survives an update.
	eq.Icon = "⛵"
	if err := db.UpdateEquipment(h.DB, eq); err != nil {
		t.Fatalf("UpdateEquipment: %v", err)
	}
	reloaded, _ := db.GetEquipment(h.DB, id)
	if reloaded.Icon != "⛵" {
		t.Errorf("icon after update = %q, want ⛵", reloaded.Icon)
	}

	// Clearing the icon falls back to the default.
	reloaded.Icon = ""
	if err := db.UpdateEquipment(h.DB, reloaded); err != nil {
		t.Fatalf("UpdateEquipment (clear): %v", err)
	}
	cleared, _ := db.GetEquipment(h.DB, id)
	if cleared.Icon != "🔧" {
		t.Errorf("icon after clear = %q, want 🔧", cleared.Icon)
	}
}
