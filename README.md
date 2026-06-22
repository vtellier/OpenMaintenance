# OpenMaintenance

OpenMaintenance is a **minimalist**, self-hostable, free, and open-source web app to **track maintenance tasks** for any equipment — boats, cars, homes, appliances, and more.

Define your own maintenance program, log interventions, and see at a glance what is due, soon-due, or overdue.

## Features

- **Dashboard** — see all upcoming and overdue tasks at a glance
- **Multiple equipments** — manage any number of devices in one place, each with a custom emoji icon
- **Custom maintenance program** — define tasks by time interval, hour-meter interval, or both
- **Intervention history** — log what you did, when, where, and who performed it, per equipment
- **Equipment documents** — attach manuals, invoices, or warranty papers to each equipment
- **Intervention photos** — attach photos to an intervention to record the state of a part before/after the work
- **Hour-meter tracking** — optional, for engine hours or similar metrics; a "Same hours" shortcut dismisses the freshness reminder when a machine hasn't run
- **No authentication** — anyone with network access to the app can use it; security is delegated to your deployment (reverse proxy, firewall, etc.)
- **Multi-device friendly** — works on desktop, tablet, and mobile
- **Update notifications** — the Settings page notifies you when a new release is available on GitHub
- **Backup visibility** — the Settings page shows where backups are stored and lists existing backup files

## Self-Hosting

OpenMaintenance ships as a **single binary** — no runtime, no database server, no reverse proxy required.

### Quick start

1. Download the binary for your platform from the [releases page](https://github.com/vtellier/OpenMaintenance/releases).
2. Run it:
   ```bash
   ./openmaintenance-vX.Y.Z
   ```
   Replace `vX.Y.Z` with the version you downloaded (e.g. `v1.2.3`).
3. Open your browser at `http://localhost:3001`.

On first run, the binary creates two files next to itself:
- `maintenance.db` — your SQLite database
- `config.yaml` — configuration file with default values

### Configuration

Edit `config.yaml` to change the port or database path, then restart the binary:

```yaml
server:
  port: 3001              # TCP port the HTTP server listens on

database:
  path: ./maintenance.db  # Path to the SQLite file (relative to binary or absolute)
```

### Deploy as a systemd service on Ubuntu

**1. Install build dependencies**

```bash
sudo apt install golang-go nodejs
sudo npm install -g pnpm
```

**2. Build**

```bash
git clone https://github.com/vtellier/OpenMaintenance.git
cd OpenMaintenance
make build
```

**3. Install**

```bash
sudo mkdir -p /opt/openmaintenance
sudo cp backend/bin/openmaintenance /opt/openmaintenance/
sudo useradd --system --no-create-home --home /opt/openmaintenance openmaintenance
sudo chown -R openmaintenance:openmaintenance /opt/openmaintenance
```

**4. Create the systemd unit**

Create `/etc/systemd/system/openmaintenance.service`:
```bash
sudo touch /etc/systemd/system/openmaintenance.service
```

```ini
[Unit]
Description=OpenMaintenance
After=network.target

[Service]
User=openmaintenance
WorkingDirectory=/opt/openmaintenance
ExecStart=/opt/openmaintenance/openmaintenance
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

**5. Enable and start**

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now openmaintenance
```

The app is now running at `http://localhost:3001`. The database and config file are created in `/opt/openmaintenance/` on first start.

### Run on Windows

1. Download `openmaintenance-vX.Y.Z.exe` from the [releases page](https://github.com/vtellier/OpenMaintenance/releases) (replace `vX.Y.Z` with the actual version, e.g. `v1.2.3`).
2. Open a terminal (PowerShell or Command Prompt) in the directory where you saved the file and run:
   ```
   .\openmaintenance-vX.Y.Z.exe
   ```
3. Open your browser at `http://localhost:3001`.

The database and config file are created next to the executable on first run.

### Add a desktop icon on Ubuntu

Create a `.desktop` launcher so OpenMaintenance appears in your app grid:

```bash
cat > ~/.local/share/applications/openmaintenance.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=OpenMaintenance
Comment=Track maintenance tasks
Exec=xdg-open http://localhost:3001
Icon=preferences-system
Terminal=false
Categories=Utility;
EOF
```

The icon will appear in the GNOME Activities overview after the next login (or run `update-desktop-database ~/.local/share/applications` to apply immediately).

To use a custom icon, replace `preferences-system` with the absolute path to a `.png` or `.svg` file.

### Supported platforms

- Linux (x86-64, ARM64 — Raspberry Pi compatible)
- macOS
- Windows

## Development

Run the backend test suite:

```bash
make test-backend
```

Populate a running instance with a demo dataset (overdue / due-soon / OK statuses):

```bash
make seed
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full development setup.

## License

MIT — see [LICENSE](./LICENSE).
