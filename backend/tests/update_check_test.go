package tests

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/vtellier/OpenMaintenance/internal/generated"
	"github.com/vtellier/OpenMaintenance/internal/handlers"
	"github.com/vtellier/OpenMaintenance/internal/updater"
)

const githubLatestReleaseURL = "https://api.github.com/repos/vtellier/OpenMaintenance/releases/latest"

// fakeGitHub stands in for GitHub's API as the update checker's HTTP
// transport, so no test reaches the network. It counts the requests it gets
// and answers each one with respond.
type fakeGitHub struct {
	requests atomic.Int32
	respond  func(*http.Request) (*http.Response, error)
}

func (f *fakeGitHub) RoundTrip(r *http.Request) (*http.Response, error) {
	f.requests.Add(1)
	return f.respond(r)
}

func githubAnswer(code int, header http.Header, body string) func(*http.Request) (*http.Response, error) {
	return func(*http.Request) (*http.Response, error) {
		if header == nil {
			header = http.Header{}
		}
		return &http.Response{StatusCode: code, Header: header, Body: io.NopCloser(strings.NewReader(body))}, nil
	}
}

func githubRelease(tag string) func(*http.Request) (*http.Response, error) {
	return githubAnswer(http.StatusOK, nil,
		`{"tag_name":"`+tag+`","html_url":"https://github.com/vtellier/OpenMaintenance/releases/tag/`+tag+`"}`)
}

// updateAPI serves the API routes, for a backend running version, with an
// update checker that talks to github.
func updateAPI(version string, github *fakeGitHub) *echo.Echo {
	e := echo.New()
	checker := updater.NewChecker(version, &http.Client{Transport: github})
	generated.RegisterHandlersWithBaseURL(e, &handlers.Handler{Updates: checker}, "/api")
	return e
}

func serve(e *echo.Echo, method, path string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(method, path, nil))
	return rec
}

func decodeUpdateStatus(t *testing.T, rec *httptest.ResponseRecorder) generated.UpdateStatus {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body)
	}
	var status generated.UpdateStatus
	if err := json.Unmarshal(rec.Body.Bytes(), &status); err != nil {
		t.Fatalf("decode %q: %v", rec.Body, err)
	}
	return status
}

func checkForUpdates(t *testing.T, e *echo.Echo) generated.UpdateStatus {
	t.Helper()
	return decodeUpdateStatus(t, serve(e, http.MethodPost, "/api/update-status/check"))
}

func getUpdateStatus(t *testing.T, e *echo.Echo) generated.UpdateStatus {
	t.Helper()
	return decodeUpdateStatus(t, serve(e, http.MethodGet, "/api/update-status"))
}

func TestGetUpdateStatus_BeforeAnyCheck(t *testing.T) {
	github := &fakeGitHub{respond: githubRelease("v0.6.0")}
	e := updateAPI("v0.5.0", github)

	got := getUpdateStatus(t, e)

	if got.CurrentVersion != "v0.5.0" || got.LatestVersion != "" || got.UpdateAvailable {
		t.Errorf("expected only the current version, got %+v", got)
	}
	if got.ReleaseUrl != nil || got.CheckedAt != nil || got.Error != nil || got.Cached != nil {
		t.Errorf("expected no release_url, checked_at, error or cached, got %+v", got)
	}
	if n := github.requests.Load(); n != 0 {
		t.Errorf("GET must not query GitHub, got %d requests", n)
	}
}

func TestCheckForUpdates_NewerRelease(t *testing.T) {
	var requestedURL string
	github := &fakeGitHub{respond: func(r *http.Request) (*http.Response, error) {
		requestedURL = r.URL.String()
		return githubRelease("v0.6.0")(r)
	}}
	e := updateAPI("v0.5.0", github)

	got := checkForUpdates(t, e)

	if requestedURL != githubLatestReleaseURL {
		t.Errorf("expected a request to %s, got %q", githubLatestReleaseURL, requestedURL)
	}
	if !got.UpdateAvailable || got.LatestVersion != "v0.6.0" || got.CurrentVersion != "v0.5.0" {
		t.Errorf("expected v0.6.0 available over v0.5.0, got %+v", got)
	}
	if got.ReleaseUrl == nil || *got.ReleaseUrl != "https://github.com/vtellier/OpenMaintenance/releases/tag/v0.6.0" {
		t.Errorf("expected the v0.6.0 release URL, got %v", got.ReleaseUrl)
	}
	if got.CheckedAt == nil || got.Error != nil {
		t.Errorf("expected checked_at and no error, got checked_at=%v error=%v", got.CheckedAt, got.Error)
	}
	if got.Cached == nil || *got.Cached {
		t.Errorf("expected cached=false, got %v", got.Cached)
	}

	// The status served to page loads (the banner) shows the new result.
	after := getUpdateStatus(t, e)
	if !after.UpdateAvailable || after.LatestVersion != "v0.6.0" || after.ReleaseUrl == nil {
		t.Errorf("expected GET to return the checked result, got %+v", after)
	}
	if after.Cached != nil {
		t.Errorf("GET must not set cached, got %v", *after.Cached)
	}
	if n := github.requests.Load(); n != 1 {
		t.Errorf("expected 1 GitHub request, got %d", n)
	}
}

func TestCheckForUpdates_UpToDate(t *testing.T) {
	e := updateAPI("v0.6.0", &fakeGitHub{respond: githubRelease("v0.6.0")})

	got := checkForUpdates(t, e)

	if got.UpdateAvailable || got.LatestVersion != "v0.6.0" || got.CurrentVersion != "v0.6.0" || got.Error != nil {
		t.Errorf("expected up to date on v0.6.0, got %+v", got)
	}
}

func TestCheckForUpdates_ReportsWhyTheCheckFailed(t *testing.T) {
	tests := []struct {
		name    string
		respond func(*http.Request) (*http.Response, error)
		want    generated.UpdateStatusError
	}{
		{"offline", func(*http.Request) (*http.Response, error) {
			return nil, errors.New("dial tcp: lookup api.github.com: no such host")
		}, generated.Unreachable},
		{"rate limit used up", githubAnswer(http.StatusForbidden, http.Header{"X-Ratelimit-Remaining": {"0"}}, `{"message":"API rate limit exceeded"}`), generated.RateLimited},
		{"secondary rate limit", githubAnswer(http.StatusForbidden, http.Header{"Retry-After": {"60"}}, `{}`), generated.RateLimited},
		{"too many requests", githubAnswer(http.StatusTooManyRequests, nil, `{}`), generated.RateLimited},
		{"forbidden, not rate limited", githubAnswer(http.StatusForbidden, http.Header{"X-Ratelimit-Remaining": {"42"}}, `{}`), generated.UnexpectedResponse},
		{"server error", githubAnswer(http.StatusBadGateway, nil, ``), generated.UnexpectedResponse},
		{"unreadable body", githubAnswer(http.StatusOK, nil, `<html>`), generated.UnexpectedResponse},
		{"release without tag", githubAnswer(http.StatusOK, nil, `{}`), generated.UnexpectedResponse},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := updateAPI("v0.5.0", &fakeGitHub{respond: tt.respond})

			got := checkForUpdates(t, e)

			if got.Error == nil || *got.Error != tt.want {
				t.Fatalf("expected error %q, got %v", tt.want, got.Error)
			}
			if got.CheckedAt == nil {
				t.Error("expected checked_at on a failed check")
			}
			if got.LatestVersion != "" || got.UpdateAvailable || got.ReleaseUrl != nil {
				t.Errorf("expected no release info, got %+v", got)
			}
			if got.Cached == nil || *got.Cached {
				t.Errorf("expected cached=false, got %v", got.Cached)
			}
		})
	}
}

func TestCheckForUpdates_ReusesResultLessThanAMinuteOld(t *testing.T) {
	// synctest's fake clock lets the test wait a minute instantly.
	synctest.Test(t, func(t *testing.T) {
		github := &fakeGitHub{respond: githubRelease("v0.6.0")}
		e := updateAPI("v0.5.0", github)

		first := checkForUpdates(t, e)

		time.Sleep(updater.MinCheckInterval - time.Second)
		second := checkForUpdates(t, e)
		if n := github.requests.Load(); n != 1 {
			t.Fatalf("expected a check %v later not to query GitHub, got %d requests", updater.MinCheckInterval-time.Second, n)
		}
		if second.Cached == nil || !*second.Cached {
			t.Errorf("expected cached=true, got %v", second.Cached)
		}
		if !second.CheckedAt.Equal(*first.CheckedAt) || second.LatestVersion != "v0.6.0" || !second.UpdateAvailable {
			t.Errorf("expected the first result, got %+v (first %+v)", second, first)
		}

		time.Sleep(time.Second)
		third := checkForUpdates(t, e)
		if n := github.requests.Load(); n != 2 {
			t.Fatalf("expected a check %v later to query GitHub, got %d requests", updater.MinCheckInterval, n)
		}
		if third.Cached == nil || *third.Cached {
			t.Errorf("expected cached=false, got %v", third.Cached)
		}
		if !third.CheckedAt.After(*first.CheckedAt) {
			t.Errorf("expected a newer checked_at than %v, got %v", *first.CheckedAt, *third.CheckedAt)
		}
	})
}

func TestCheckForUpdates_FailedCheckIsAlsoThrottled(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		github := &fakeGitHub{respond: githubAnswer(http.StatusTooManyRequests, nil, `{}`)}
		e := updateAPI("v0.5.0", github)

		checkForUpdates(t, e)
		time.Sleep(updater.MinCheckInterval / 2)
		got := checkForUpdates(t, e)

		if n := github.requests.Load(); n != 1 {
			t.Errorf("expected 1 GitHub request, got %d", n)
		}
		if got.Cached == nil || !*got.Cached || got.Error == nil || *got.Error != generated.RateLimited {
			t.Errorf("expected the cached rate_limited result, got %+v", got)
		}
	})
}

func TestCheckForUpdates_ConcurrentChecksShareOneGitHubRequest(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		answer := make(chan struct{})
		github := &fakeGitHub{respond: func(r *http.Request) (*http.Response, error) {
			<-answer
			return githubRelease("v0.6.0")(r)
		}}
		e := updateAPI("v0.5.0", github)

		const callers = 5
		recs := make([]*httptest.ResponseRecorder, callers)
		var wg sync.WaitGroup
		for i := range callers {
			wg.Go(func() { recs[i] = serve(e, http.MethodPost, "/api/update-status/check") })
		}
		synctest.Wait() // every caller is now waiting for GitHub to answer
		close(answer)
		wg.Wait()

		if n := github.requests.Load(); n != 1 {
			t.Errorf("expected %d concurrent checks to share 1 GitHub request, got %d", callers, n)
		}
		for i, rec := range recs {
			got := decodeUpdateStatus(t, rec)
			if got.LatestVersion != "v0.6.0" || got.Cached == nil || *got.Cached {
				t.Errorf("caller %d: expected the fresh v0.6.0 result, got %+v", i, got)
			}
		}
	})
}

func TestCheckForUpdates_FailedCheckKeepsLastSuccessfulResult(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		github := &fakeGitHub{respond: githubRelease("v0.6.0")}
		e := updateAPI("v0.5.0", github)
		checkForUpdates(t, e)

		time.Sleep(updater.MinCheckInterval)
		github.respond = func(*http.Request) (*http.Response, error) {
			return nil, errors.New("connection refused")
		}
		got := checkForUpdates(t, e)

		if got.Error == nil || *got.Error != generated.Unreachable {
			t.Fatalf("expected error unreachable, got %v", got.Error)
		}
		if !got.UpdateAvailable || got.LatestVersion != "v0.6.0" || got.ReleaseUrl == nil {
			t.Errorf("expected v0.6.0 still reported available, got %+v", got)
		}

		time.Sleep(updater.MinCheckInterval)
		github.respond = githubRelease("v0.6.0")
		if got := checkForUpdates(t, e); got.Error != nil {
			t.Errorf("expected a successful check to clear the error, got %v", *got.Error)
		}
	})
}
