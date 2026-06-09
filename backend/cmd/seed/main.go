// Command seed populates a running OpenMaintenance instance with a realistic
// demo dataset via the public REST API.
//
// It is intentionally API-driven (not raw SQL) so it stays decoupled from the
// SQLite schema and keeps working across migrations. All dates are computed
// relative to "now" at run time, so the Dashboard always shows a meaningful
// spread of Overdue / Due-soon / OK statuses no matter when you run it.
//
//	go run ./cmd/seed            # against http://localhost:3001
//	OM_BASE_URL=… go run ./cmd/seed
//
// The backend must already be running. The seeder appends data; for a clean
// slate, stop the server, delete backend/maintenance.db, restart, then seed.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

var baseURL = envOr("OM_BASE_URL", "http://localhost:3001")

func main() {
	log.SetFlags(0)
	if err := waitHealthy(); err != nil {
		log.Fatalf("seed: backend not reachable at %s: %v\n  → start it first (see the run-openmaintenance skill)", baseURL, err)
	}

	now := time.Now()
	monthsAgo := func(n int) time.Time { return now.AddDate(0, -n, 0) }
	daysAgo := func(n int) time.Time { return now.AddDate(0, 0, -n) }

	// ── Equipment 1: boat engine — hour-tracked ──────────────────────────────
	// Current meter 512 h, commissioned 3 years ago.
	engine := createEquipment(map[string]any{
		"name":            "Yanmar 4JH45 — Main Engine",
		"description":     "45 hp diesel inboard. Primary propulsion.",
		"icon":            "⚓",
		"tracks_hours":    true,
		"hours":           512,
		"commissioned_at": monthsAgo(36).Format("2006-01-02"),
	})

	// OVERDUE by hours: last service at 380 h, 132 h ago vs a 100 h interval.
	oil := createTask(map[string]any{
		"equipment_id":    engine,
		"name":            "Engine oil & filter change",
		"description":     "Drain oil, replace oil and fuel filters.",
		"hours_interval":  100,
		"months_interval": 12,
	})
	createIntervention(map[string]any{"task_id": oil, "date": rfc(monthsAgo(26)), "location": "Home marina", "performed_by": "Owner", "comments": "Routine seasonal change.", "hours_at": 180})
	createIntervention(map[string]any{"task_id": oil, "date": rfc(monthsAgo(15)), "location": "Home marina", "performed_by": "Owner", "hours_at": 290})
	createIntervention(map[string]any{"task_id": oil, "date": rfc(monthsAgo(8)), "location": "Boatyard", "performed_by": "MarineTech SARL", "comments": "Oil + filters + belt inspection.", "hours_at": 380})

	// OK: last impeller at 400 h, 112 h into a 250 h interval.
	impeller := createTask(map[string]any{
		"equipment_id":   engine,
		"name":           "Raw-water pump impeller",
		"description":    "Inspect and replace cooling-water impeller.",
		"hours_interval": 250,
	})
	createIntervention(map[string]any{"task_id": impeller, "date": rfc(monthsAgo(18)), "location": "Boatyard", "performed_by": "MarineTech SARL", "hours_at": 150})
	createIntervention(map[string]any{"task_id": impeller, "date": rfc(monthsAgo(4)), "location": "Home marina", "performed_by": "Owner", "comments": "Slight wear on two vanes.", "hours_at": 400})

	// DUE SOON: 23 months into a 24-month interval (time-based task).
	coolant := createTask(map[string]any{
		"equipment_id":    engine,
		"name":            "Coolant flush & replace",
		"description":     "Flush freshwater circuit, refill with coolant.",
		"months_interval": 24,
	})
	createIntervention(map[string]any{"task_id": coolant, "date": rfc(monthsAgo(23)), "location": "Boatyard", "performed_by": "MarineTech SARL", "hours_at": 60})

	// Exceptional (unplanned) intervention — no task, no due-date side effect.
	createIntervention(map[string]any{
		"equipment_id":      engine,
		"exceptional_label": "Replaced corroded battery terminal",
		"date":              rfc(daysAgo(40)),
		"location":          "Home marina",
		"performed_by":      "Owner",
		"comments":          "Found green corrosion during pre-trip check; cleaned and replaced lug.",
		"hours_at":          500,
	})

	// ── Equipment 2: family car — time-based only ────────────────────────────
	car := createEquipment(map[string]any{
		"name":            "VW Golf — Family Car",
		"description":     "2019 1.5 TSI. Daily driver.",
		"icon":            "🚗",
		"commissioned_at": monthsAgo(60).Format("2006-01-02"),
	})

	// OVERDUE: last oil change 13 months ago vs a 12-month interval.
	carOil := createTask(map[string]any{"equipment_id": car, "name": "Engine oil change", "description": "Oil and filter service.", "months_interval": 12})
	createIntervention(map[string]any{"task_id": carOil, "date": rfc(monthsAgo(25)), "location": "Garage Dupont", "performed_by": "Garage Dupont"})
	createIntervention(map[string]any{"task_id": carOil, "date": rfc(monthsAgo(13)), "location": "Garage Dupont", "performed_by": "Garage Dupont", "comments": "Used 5W-30 long-life."})

	// OK: tire rotation 2 months into a 6-month interval.
	tires := createTask(map[string]any{"equipment_id": car, "name": "Tire rotation", "months_interval": 6})
	createIntervention(map[string]any{"task_id": tires, "date": rfc(monthsAgo(2)), "location": "Garage Dupont", "performed_by": "Garage Dupont"})

	// DUE SOON: inspection 23 months into a 24-month interval.
	mot := createTask(map[string]any{"equipment_id": car, "name": "Technical inspection", "description": "Mandatory periodic vehicle inspection.", "months_interval": 24})
	createIntervention(map[string]any{"task_id": mot, "date": rfc(monthsAgo(23)), "location": "Inspection centre", "performed_by": "Autosur", "comments": "Passed, no remarks."})

	// ── Equipment 3: home heating boiler — time-based only ───────────────────
	boiler := createEquipment(map[string]any{
		"name":            "Gas Boiler — Home Heating",
		"description":     "Condensing gas boiler, 24 kW.",
		"icon":            "🔥",
		"commissioned_at": monthsAgo(96).Format("2006-01-02"),
	})

	// OK: annual service done 5 months ago.
	service := createTask(map[string]any{"equipment_id": boiler, "name": "Annual boiler service", "description": "Mandatory yearly maintenance and safety check.", "months_interval": 12})
	createIntervention(map[string]any{"task_id": service, "date": rfc(monthsAgo(5)), "location": "Home", "performed_by": "ChauffageSud", "comments": "Combustion within spec."})

	// DUE SOON: chimney sweep ~11 months into a 12-month interval.
	chimney := createTask(map[string]any{"equipment_id": boiler, "name": "Chimney / flue sweep", "months_interval": 12})
	createIntervention(map[string]any{"task_id": chimney, "date": rfc(daysAgo(341)), "location": "Home", "performed_by": "Ramonage Express"})

	fmt.Printf("\n✓ Seed complete — 3 equipments, 8 tasks, 13 interventions.\n  Open %s to see Overdue / Due-soon / OK statuses.\n", baseURL)
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

func createEquipment(body map[string]any) int {
	id := post("/api/equipments", body)
	fmt.Printf("  equipment #%d  %v\n", id, body["name"])
	return id
}

func createTask(body map[string]any) int {
	id := post("/api/tasks", body)
	fmt.Printf("    task #%d  %v\n", id, body["name"])
	return id
}

func createIntervention(body map[string]any) int {
	id := post("/api/interventions", body)
	label := body["exceptional_label"]
	if label == nil {
		label = body["date"]
	}
	fmt.Printf("      intervention #%d  %v\n", id, label)
	return id
}

// post sends a JSON POST and returns the created object's integer id.
func post(path string, body map[string]any) int {
	payload, err := json.Marshal(body)
	if err != nil {
		log.Fatalf("seed: marshal %s: %v", path, err)
	}
	resp, err := http.Post(baseURL+path, "application/json", bytes.NewReader(payload))
	if err != nil {
		log.Fatalf("seed: POST %s: %v", path, err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Fatalf("seed: POST %s → %d: %s\n  payload: %s", path, resp.StatusCode, data, payload)
	}
	var out struct {
		ID int `json:"id"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		log.Fatalf("seed: decode %s response: %v\n  body: %s", path, err, data)
	}
	return out.ID
}

func waitHealthy() error {
	var lastErr error
	for i := 0; i < 20; i++ {
		resp, err := http.Get(baseURL + "/api/version")
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
			lastErr = fmt.Errorf("status %d", resp.StatusCode)
		} else {
			lastErr = err
		}
		time.Sleep(300 * time.Millisecond)
	}
	return lastErr
}

func rfc(t time.Time) string { return t.Format(time.RFC3339) }

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
