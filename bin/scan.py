#!/usr/bin/env python3
"""
Single responsibility: Command-line scanner tool.
Scans a target directory and streams findings as JSON lines or a single JSON summary.
"""

import sys
import json
import argparse
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.scanner import scan_workspace


def main():
    parser = argparse.ArgumentParser(description="Scan a workspace for expendable artifacts and disk usage.")
    parser.add_argument("path", nargs="?", default=".", help="Root directory to scan (default: current directory)")
    parser.add_argument("--json", action="store_true", help="Output all results as a single aggregated JSON")
    args = parser.parse_args()

    root_path = Path(args.path).resolve()
    if not root_path.exists():
        print(f"Error: Path '{root_path}' does not exist.", file=sys.stderr)
        sys.exit(1)

    if args.json:
        results = list(scan_workspace(str(root_path)))
        print(json.dumps(results, indent=2))
    else:
        for item in scan_workspace(str(root_path)):
            print(json.dumps(item))


if __name__ == "__main__":
    main()
