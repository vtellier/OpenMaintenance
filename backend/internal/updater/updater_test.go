package updater

import "testing"

func Test_parseSemver(t *testing.T) {
	tests := []struct {
		input   string
		want    [3]int
		wantErr bool
	}{
		{"v0.4.1", [3]int{0, 4, 1}, false},
		{"0.4.1", [3]int{0, 4, 1}, false},
		{"v1.2.3", [3]int{1, 2, 3}, false},
		{"v1.2.3-dirty", [3]int{1, 2, 3}, false},
		{"v1.2.3-5-gabcdef", [3]int{1, 2, 3}, false},
		{"v0.5.0", [3]int{0, 5, 0}, false},
		{"dev", [3]int{}, true},
		{"invalid", [3]int{}, true},
		{"1.2", [3]int{}, true},
		{"1.2.3.4", [3]int{}, true},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got, err := parseSemver(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseSemver(%q) err = %v, wantErr = %v", tt.input, err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("parseSemver(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func Test_isNewer(t *testing.T) {
	tests := []struct {
		latest, current string
		want            bool
	}{
		{"v0.5.0", "v0.4.1", true},  // minor bump — the reported bug scenario
		{"v0.4.2", "v0.4.1", true},  // patch bump
		{"v1.0.0", "v0.9.9", true},  // major bump
		{"v0.4.1", "v0.4.1", false}, // same version
		{"v0.4.0", "v0.4.1", false}, // older patch
		{"v0.4.1", "v0.5.0", false}, // older minor
		{"v0.9.9", "v1.0.0", false}, // older major
		{"invalid", "v0.4.1", false}, // unparseable latest
		{"v0.4.1", "dev", false},    // unparseable current (dev build)
	}
	for _, tt := range tests {
		t.Run(tt.latest+"_vs_"+tt.current, func(t *testing.T) {
			got := isNewer(tt.latest, tt.current)
			if got != tt.want {
				t.Errorf("isNewer(%q, %q) = %v, want %v", tt.latest, tt.current, got, tt.want)
			}
		})
	}
}
