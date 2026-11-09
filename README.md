# Space Explorer

A lightweight, modular, and cross-platform disk space analyzer and clean-up dashboard.

## Features

- Scans workspace projects for expendable build artifacts (`node_modules`, `target`, `.build`, `.venv`, `.next`, `dist`, `Pods`, `.gradle`, etc.).
- Inspects and cleans package manager caches (`npm`, `yarn`, `pip`, `cargo`, `homebrew`, `gradle`, iOS simulator states).
- Single-responsibility scripts composed with zero code duplication.
- Extensible via JSON rules in `lib/rules.json` or `~/.space-explorer-rules.json`.
- Runs on macOS, Windows, and Linux.

## Running Space Explorer

### Web Dashboard

On macOS / Linux:
```bash
./run.sh
```

On Windows:
```cmd
run.bat
```

The server starts on `http://127.0.0.1:3888` and opens the default browser.

### Desktop Mode (Electron)

```bash
npm start
```

### Command Line Interface

Scan workspace:
```bash
python3 bin/scan.py ~/Projects

python3 bin/scan.py ~/Projects --json
```

Preview cleanable targets (dry run):
```bash
python3 bin/clean.py --root ~/Projects --dry-run ~/Projects/<project>/node_modules
```

Move to Trash:
```bash
python3 bin/clean.py --root ~/Projects ~/Projects/<project>/node_modules
```

Permanent removal:
```bash
python3 bin/clean.py --root ~/Projects --permanent ~/Projects/<project>/target
```

Inspect and clean package caches:
```bash
python3 bin/cache.py --list

python3 bin/cache.py --clean npm

python3 bin/cache.py --all
```
