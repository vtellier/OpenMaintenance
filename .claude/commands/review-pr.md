---
description: Check out a GitHub PR, build it, and run it locally with seeded demo data for testing
argument-hint: <pr-number>
allowed-tools: Bash, BashOutput, Skill
---

Set up PR **#$ARGUMENTS** for local testing. The user invoking this command is
explicit authorization to run the `gh pr checkout` below — do not ask again.

Follow these steps in order. Stop and report if any step fails.

1. **Free the ports — never switch to a new one.** Kill whatever currently
   holds the backend (3001) and Vite (5173) ports, whether it is a shell
   process or a previous Claude background task:

   ```bash
   for port in 3001 5173; do lsof -ti:$port | xargs -r kill; done
   ```

   Give them a moment to release, then confirm both are free
   (`lsof -ti:3001 || echo free`). If a port is still held, find the PID and
   kill it — do not fall back to a different port.

2. **Check out the PR** (requires a clean working tree; if dirty, stop and tell
   the user):

   ```bash
   gh pr checkout $ARGUMENTS
   ```

3. **Build** the binary (frontend + embedded static + Go):

   ```bash
   make build
   ```

4. **Start the backend as a Claude-tracked background task** — use the Bash
   tool with `run_in_background: true`, NOT a shell `&`, so the logs stay
   readable via `BashOutput`:

   ```
   Bash  command="cd backend && ./bin/openmaintenance"  run_in_background=true
   ```

5. **Wait for readiness, then seed** the demo dataset:

   ```bash
   timeout 30 bash -c 'until curl -sf http://localhost:3001/api/version >/dev/null; do sleep 1; done'
   make seed
   ```

6. **Print the access URLs** so the user can test on desktop and phone (same
   Wi-Fi):

   ```bash
   echo "Desktop: http://localhost:3001"
   echo "Phone:   http://$(hostname -I | awk '{print $1}'):3001"
   ```

7. Report: PR title, the background task id (so the user can ask for logs), and
   the two URLs. The backend keeps running for testing — leave it up.

For details on driving the running app (screenshots, navigation), the
`run-openmaintenance` skill applies.
