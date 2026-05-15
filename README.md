# OpenMaintenance

OpenMaintenance is a **minimalist**, self-hostable, free, and open-source web app to **track maintenance tasks** for any equipment — boats, cars, homes, appliances, and more.

Define your own maintenance program, log interventions, and see at a glance what is due, soon-due, or overdue.

## Features

- **Dashboard** — see all upcoming and overdue tasks at a glance
- **Multiple equipments** — manage any number of devices in one place
- **Custom maintenance program** — define tasks by time interval, hour-meter interval, or both
- **Intervention history** — log what you did and when, per equipment
- **Hour-meter tracking** — optional, for engine hours or similar metrics
- **No authentication** — anyone with network access to the app can use it; security is delegated to your deployment (reverse proxy, firewall, etc.)
- **Multi-device friendly** — works on desktop, tablet, and mobile

## Self-Hosting

OpenMaintenance ships as a **single binary** — no runtime, no database server, no reverse proxy required.

### Quick start

1. Download the binary for your platform from the [releases page](https://github.com/vtellier/OpenMaintenance/releases).
2. Run it:
   ```bash
   ./openmaintenance
   ```
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

### Supported platforms

- Linux (x86-64, ARM64 — Raspberry Pi compatible)
- macOS
- Windows

## License

MIT — see [LICENSE](./LICENSE).
