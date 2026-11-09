#!/usr/bin/env python3
"""
Single responsibility: Command-line tool to inspect and purge package manager caches.
Cross-platform (macOS / Windows / Linux).
"""

import sys
import json
import argparse
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.cache_cleaners import scan_caches, clean_cache


def format_bytes(b: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if b < 1024.0:
            return f"{b:.1f} {unit}"
        b /= 1024.0
    return f"{b:.1f} PB"


def main():
    parser = argparse.ArgumentParser(description="Inspect and clean package manager and developer caches.")
    parser.add_argument("--list", action="store_true", help="List all discovered caches and sizes")
    parser.add_argument("--clean", nargs="*", help="Clean specific cache IDs (e.g. npm, homebrew, pip, gradle, simulators)")
    parser.add_argument("--all", action="store_true", help="Clean all active package caches")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")
    args = parser.parse_args()

    caches = scan_caches()

    if args.list or (not args.clean and not args.all):
        if args.json:
            print(json.dumps(caches, indent=2))
        else:
            print(f"{'Cache ID':<12} | {'Name':<22} | {'Size':<10} | {'Status':<10} | {'Path'}")
            print("-" * 85)
            for c in caches:
                sz = format_bytes(c["size_bytes"]) if c["exists"] else "-"
                status = "Active" if c["exists"] and c["size_bytes"] > 0 else "Empty/Absent"
                print(f"{c['id']:<12} | {c['name']:<22} | {sz:<10} | {status:<10} | {c['path']}")
        return

    # Perform cleaning
    to_clean = []
    if args.all:
        to_clean = [c["id"] for c in caches if c["exists"] and c["size_bytes"] > 0]
    elif args.clean:
        to_clean = args.clean

    print(f"Purging {len(to_clean)} caches...")
    for cid in to_clean:
        res = clean_cache(cid)
        if res.get("success"):
            reclaimed = format_bytes(res.get("bytes_reclaimed", 0))
            print(f"✓ {res.get('name', cid)}: Reclaimed {reclaimed} via {res.get('method', 'clean')}")
        else:
            print(f"✗ {cid}: Failed ({res.get('error')})", file=sys.stderr)


if __name__ == "__main__":
    main()
