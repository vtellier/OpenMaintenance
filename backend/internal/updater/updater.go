package updater

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const latestReleaseURL = "https://api.github.com/repos/vtellier/OpenMaintenance/releases/latest"

// releasePagePrefix is where every release page of the project lives.
const releasePagePrefix = "https://github.com/vtellier/OpenMaintenance/releases/"

// MinCheckInterval is the shortest time between two queries to GitHub.
// GitHub allows 60 unauthenticated API requests per hour per IP address.
const MinCheckInterval = time.Minute

// FailureReason says why a check failed.
type FailureReason string

const (
	// Unreachable: GitHub could not be reached (offline, DNS, timeout).
	Unreachable FailureReason = "unreachable"
	// RateLimited: GitHub's API rate limit is used up.
	RateLimited FailureReason = "rate_limited"
	// UnexpectedResponse: GitHub answered with another error status or an unreadable body.
	UnexpectedResponse FailureReason = "unexpected_response"
)

type UpdateStatus struct {
	CurrentVersion string
	// LatestVersion, UpdateAvailable and ReleaseURL come from the last
	// successful check. They are empty until a check succeeds.
	LatestVersion   string
	UpdateAvailable bool
	ReleaseURL      string
	// CheckedAt is when the last check ended, successful or not. Zero until
	// the first check ends.
	CheckedAt time.Time
	// Failure says why the last check failed. Empty if it succeeded.
	Failure FailureReason
	// Cached is set by Check when it returned the previous result without
	// querying GitHub, because that result is less than MinCheckInterval old.
	Cached bool
}

type githubRelease struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
}

// Checker queries GitHub for the latest release and remembers the result.
// It is safe for concurrent use, and protects GitHub's rate limit: it never
// queries GitHub more than once per MinCheckInterval, and concurrent Check
// calls share one query.
type Checker struct {
	client *http.Client

	mu       sync.Mutex
	status   UpdateStatus
	inFlight chan struct{} // closed when the running check ends; nil when none runs
}

// NewChecker returns a Checker for the running version. A nil client means a
// default client with a 10 s timeout; tests pass one with a fake transport.
// No check has run yet: Status reports only the current version until Check
// is called.
func NewChecker(currentVersion string, client *http.Client) *Checker {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return &Checker{
		client: client,
		status: UpdateStatus{CurrentVersion: currentVersion},
	}
}

// Status returns the result of the last check, without querying GitHub.
func (c *Checker) Status() UpdateStatus {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.status
}

// Check queries GitHub and returns the new status. If a check is already
// running, it waits for that one instead of starting another. If the previous
// check ended less than MinCheckInterval ago, it returns that result with
// Cached set, without querying GitHub. If ctx ends first, it returns the
// status as it is; the running check carries on for the other callers.
func (c *Checker) Check(ctx context.Context) UpdateStatus {
	c.mu.Lock()
	if c.inFlight == nil {
		if last := c.status.CheckedAt; !last.IsZero() && time.Since(last) < MinCheckInterval {
			status := c.status
			c.mu.Unlock()
			status.Cached = true
			return status
		}
		c.inFlight = make(chan struct{})
		go c.run(c.inFlight)
	}
	done := c.inFlight
	c.mu.Unlock()

	select {
	case <-done:
	case <-ctx.Done():
	}
	return c.Status()
}

// run queries GitHub once and records the result. It does not use the
// caller's context, so a caller going away does not cancel the check that
// other callers wait for; the client timeout bounds it instead.
func (c *Checker) run(done chan struct{}) {
	release, reason, err := fetchLatestRelease(context.Background(), c.client)

	c.mu.Lock()
	defer c.mu.Unlock()
	c.status.CheckedAt = time.Now()
	if err != nil {
		log.Printf("update check failed (%s): %v", reason, err)
		// Keep the last successful result: a newer release does not stop
		// existing because GitHub is unreachable right now.
		c.status.Failure = reason
	} else {
		c.status.Failure = ""
		c.status.LatestVersion = release.TagName
		c.status.ReleaseURL = release.HTMLURL
		c.status.UpdateAvailable = isNewer(release.TagName, c.status.CurrentVersion)
	}
	c.inFlight = nil
	close(done)
}

// fetchLatestRelease asks GitHub for the latest release. On failure it returns
// the reason to show users, and the underlying error to log.
func fetchLatestRelease(ctx context.Context, client *http.Client) (githubRelease, FailureReason, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, latestReleaseURL, nil)
	if err != nil {
		return githubRelease{}, Unreachable, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := client.Do(req)
	if err != nil {
		return githubRelease{}, Unreachable, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		err := fmt.Errorf("GitHub answered HTTP %d", resp.StatusCode)
		if isRateLimited(resp) {
			return githubRelease{}, RateLimited, err
		}
		return githubRelease{}, UnexpectedResponse, err
	}

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return githubRelease{}, UnexpectedResponse, fmt.Errorf("decode GitHub release: %w", err)
	}
	if release.TagName == "" {
		return githubRelease{}, UnexpectedResponse, errors.New("GitHub release has no tag_name")
	}
	// The frontend puts html_url in a link: only accept a GitHub page.
	if !strings.HasPrefix(release.HTMLURL, releasePagePrefix) {
		return githubRelease{}, UnexpectedResponse, fmt.Errorf("GitHub release html_url %q is not under %s", release.HTMLURL, releasePagePrefix)
	}
	return release, "", nil
}

// isRateLimited reports whether GitHub refused the request because the rate
// limit is used up: 429, or 403 with no requests left or a Retry-After header.
// See https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
func isRateLimited(resp *http.Response) bool {
	switch resp.StatusCode {
	case http.StatusTooManyRequests:
		return true
	case http.StatusForbidden:
		return resp.Header.Get("X-RateLimit-Remaining") == "0" || resp.Header.Get("Retry-After") != ""
	}
	return false
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
