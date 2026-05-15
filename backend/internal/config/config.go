package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type Server struct {
	Port int `yaml:"port"`
}

type Database struct {
	Path string `yaml:"path"`
}

type Config struct {
	Server   Server   `yaml:"server"`
	Database Database `yaml:"database"`
}

var defaults = Config{
	Server:   Server{Port: 3001},
	Database: Database{Path: "./maintenance.db"},
}

const defaultYAML = `# OpenMaintenance configuration
# This file is auto-created with defaults if missing.

server:
  port: 3001          # TCP port the HTTP server listens on

database:
  path: ./maintenance.db  # Path to the SQLite file (relative to the binary or absolute)
`

func Load() (*Config, error) {
	exe, err := os.Executable()
	if err != nil {
		return nil, fmt.Errorf("config: cannot determine executable path: %w", err)
	}
	path := filepath.Join(filepath.Dir(exe), "config.yaml")

	if _, err := os.Stat(path); os.IsNotExist(err) {
		if err := os.WriteFile(path, []byte(defaultYAML), 0644); err != nil {
			return nil, fmt.Errorf("config: cannot write default config.yaml: %w", err)
		}
		cfg := defaults
		return &cfg, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("config: cannot read config.yaml: %w", err)
	}

	cfg := defaults
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("config: invalid config.yaml: %w", err)
	}

	if cfg.Server.Port < 1 || cfg.Server.Port > 65535 {
		return nil, fmt.Errorf("config: server.port %d is not a valid port number", cfg.Server.Port)
	}
	if cfg.Database.Path == "" {
		return nil, fmt.Errorf("config: database.path must not be empty")
	}

	return &cfg, nil
}
