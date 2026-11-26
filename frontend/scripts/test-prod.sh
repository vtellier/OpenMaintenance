#!/usr/bin/env bash
# Runs the Playwright suite against the production build: the Go binary that
# `make build` produces, with the built frontend embedded, instead of the Vite
# dev server and `go run .`.
#
#   cd frontend && pnpm test:prod [playwright args...]
#
# 1. Runs `make build`, so the binary is always built from the code checked out
#    now.
# 2. Copies that binary into a fresh directory, /tmp/om-test-prod.XXXXXX, with
#    its own config.yaml: port 3201 (OM_PROD_PORT overrides it), its own
#    database and files, no backups. The binary reads config.yaml from its own
#    directory and resolves database.path against it, so the run never touches
#    backend/maintenance.db, and it can run next to `make dev` (:3001, :5173).
#    A fresh directory keeps each run isolated.
# 3. Starts it, refusing a port something already listens on and checking that
#    /api/version answers with the version just built, so the suite can never
#    test a server left over from older code.
# 4. Runs the suite with OM_TEST_BASE_URL pointing at it (tests/target.ts),
#    then stops the binary and deletes its directory. Its log is kept as
#    test-results/prod-server.log.
set -euo pipefail

frontend_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
repo=$(cd "$frontend_dir/.." && pwd)
port=${OM_PROD_PORT:-3201}
url="http://127.0.0.1:$port"

fail() {
  echo "test-prod: $*" >&2
  exit 1
}

port_busy() {
  (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null
}

if port_busy; then
  fail "something already listens on port $port. Identify it first (ss -ltnp | grep ':$port\b') and stop it if it is a leftover run; otherwise set OM_PROD_PORT to a free port"
fi

make -C "$repo" build

# `make build` links backend/bin/openmaintenance to the binary it just built,
# openmaintenance-<version>.
link=$(readlink "$repo/backend/bin/openmaintenance") || fail "make build left no backend/bin/openmaintenance"
version=${link#openmaintenance-}
[ -n "$version" ] && [ "$version" != "$link" ] || fail "unexpected binary name: $link"

run_dir=$(mktemp -d /tmp/om-test-prod.XXXXXX)
pid=
stop() {
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  if [ -f "$run_dir/server.log" ]; then
    mkdir -p "$frontend_dir/test-results"
    cp "$run_dir/server.log" "$frontend_dir/test-results/prod-server.log"
  fi
  rm -rf "$run_dir"
}
trap stop EXIT
trap 'exit 130' INT TERM

cp "$repo/backend/bin/$link" "$run_dir/openmaintenance"
cat >"$run_dir/config.yaml" <<EOF
# Written by frontend/scripts/test-prod.sh for one Playwright run.
server:
  port: $port
database:
  path: ./maintenance.db
backup:
  enabled: false
  path: ./backups
  keep: 0
EOF

"$run_dir/openmaintenance" >"$run_dir/server.log" 2>&1 &
pid=$!

# Wait for the binary to answer, and make sure it is the one started above.
answer=
for _ in $(seq 1 150); do
  if ! kill -0 "$pid" 2>/dev/null; then
    cat "$run_dir/server.log" >&2 || true
    fail "the binary exited before answering on $url"
  fi
  if answer=$(curl -fsS --max-time 1 "$url/api/version" 2>/dev/null); then
    break
  fi
  sleep 0.2
done
[ -n "$answer" ] || fail "the binary did not answer on $url/api/version within 30 s"
case "$answer" in
  *"\"$version\""*) ;;
  *) fail "$url/api/version answered $answer, not version $version" ;;
esac
echo "test-prod: running the suite against $version on $url"

cd "$frontend_dir"
OM_TEST_BASE_URL="$url" pnpm exec playwright test "$@"
