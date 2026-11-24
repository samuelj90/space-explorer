# Space Explorer

A lightweight, modular, and cross-platform disk space analyzer and clean-up dashboard.

## Features

- Scans workspace projects for expendable build artifacts (`node_modules`, `target`, `.build`, `.venv`, `.next`, `dist`, `Pods`, `.gradle`, etc.).
- Inspects and cleans package manager caches (`npm`, `yarn`, `pip`, `cargo`, `homebrew`, `gradle`, iOS simulator states).
- Single-responsibility scripts composed with zero code duplication.
- Extensible via the Rules tab or JSON rules in `lib/rules.json` and `~/.space-explorer-rules.json`.
- Runs on macOS, Windows, and Linux.
- Responsive interface with light, dark, and system themes.
- Packaged desktop builds for Windows x64 and macOS Intel/Apple Silicon include Python; no separate Python installation is needed.

## Running Space Explorer

### Web Dashboard

Source use requires Node.js 20 or later, npm, and Python 3.10 or later. Install the frontend dependencies once with `npm ci`; the launchers build the interface before starting the server.

On macOS / Linux:
```bash
./run.sh
```

On Windows:
```cmd
run.bat
```

The server starts on `http://127.0.0.1:3888` and opens the default browser.
Source and web mode scan the parent directory of this repository.

### Desktop Mode (Electron)

```bash
npm ci
npm start
```

### Packaging desktop applications

On Windows, build the installer (`.exe`) and portable `.zip`:
```bash
npm ci
npm run build:win
```

On macOS, run `npm ci` followed by `npm run build:mac:arm64` for Apple Silicon or `npm run build:mac:x64` for Intel. Builds are unsigned unless signing is configured. Linux desktop packaging is not yet supported; Linux source/web mode remains available.

The build downloads a pinned, SHA-256-verified [python-build-standalone](https://github.com/astral-sh/python-build-standalone) distribution for the target platform. Its Python license is included in the packaged runtime. Output files are generated in `dist/`; the app does not download Python at runtime.

The shared brand artwork is `docs/space-explorer.svg`. The UI build renders it to `build/icon.png`, which electron-builder converts into the application and installer icons.

Packaged desktop mode scans the `Space Explorer Workspace` directory under the user's application-data directory (for example `%APPDATA%\Space Explorer Workspace` on Windows). It does not scan projects stored elsewhere. Package and system cache scanning remains separate. Custom rules continue to be stored at `~/.space-explorer-rules.json`.

### Rules Configuration

Customize and extend detection rules directly in the web/desktop interface under the **Rules** tab:
- Add custom artifact patterns (e.g. `coverage`, `.turbo`, `build`, `.parcel-cache`).
- Assign categories, descriptions, directory/file classification, and safe-to-delete indicators.
- Quick-add from common presets with a single click.
- Rules automatically persist to `~/.space-explorer-rules.json` and apply immediately to future scans.

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
