package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const latestReleaseURL = "https://api.github.com/repos/vtellier/OpenMaintenance/releases/latest"

type UpdateStatus struct {
	CurrentVersion  string
	LatestVersion   string
	UpdateAvailable bool
	ReleaseURL      string
}

type githubRelease struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
}

// CheckLatestRelease queries the GitHub API for the latest release and compares it to currentVersion.
// Returns an UpdateStatus with UpdateAvailable=false on any error (non-critical background check).
func CheckLatestRelease(ctx context.Context, currentVersion string) UpdateStatus {
	status := UpdateStatus{CurrentVersion: currentVersion}

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, latestReleaseURL, nil)
	if err != nil {
		return status
	}
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := client.Do(req)
	if err != nil {
		return status
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return status
	}

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return status
	}

	status.LatestVersion = release.TagName
	status.ReleaseURL = release.HTMLURL
	status.UpdateAvailable = isNewer(release.TagName, currentVersion)
	return status
}

// isNewer returns true if latest is a higher semver than current.
// Both are expected to be in the form "vX.Y.Z" or "vX.Y.Z-suffix".
// Any parse error returns false (don't show spurious update notifications).
func isNewer(latest, current string) bool {
	lv, err := parseSemver(latest)
	if err != nil {
		return false
	}
	cv, err := parseSemver(current)
	if err != nil {
		return false
	}
	for i := 0; i < 3; i++ {
		if lv[i] > cv[i] {
			return true
		}
		if lv[i] < cv[i] {
			return false
		}
	}
	return false
}

func parseSemver(v string) ([3]int, error) {
	v = strings.TrimPrefix(v, "v")
	// Strip pre-release / build metadata (e.g. "1.2.3-4-gabcdef-dirty" → "1.2.3")
	v = strings.SplitN(v, "-", 2)[0]
	parts := strings.Split(v, ".")
	if len(parts) != 3 {
		return [3]int{}, fmt.Errorf("not a semver: %q", v)
	}
	var out [3]int
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil {
			return [3]int{}, err
		}
		out[i] = n
	}
	return out, nil
}
