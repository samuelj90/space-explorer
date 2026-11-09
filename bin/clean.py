#!/usr/bin/env python3
"""
Single responsibility: Command-line cleanup tool.
Deletes or trashes specified paths or a JSON manifest of targets with safety validation.
"""

import sys
import json
import argparse
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.cleaner import delete_target, is_path_safe_to_delete
from lib.scanner import get_dir_size_and_count


def format_bytes(b: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if b < 1024.0:
            return f"{b:.1f} {unit}"
        b /= 1024.0
    return f"{b:.1f} PB"


def main():
    parser = argparse.ArgumentParser(description="Safely delete expendable project artifacts.")
    parser.add_argument("targets", nargs="*", help="Target artifact paths to delete")
    parser.add_argument("--root", default=".", help="Root workspace directory for boundary validation")
    parser.add_argument("--dry-run", action="store_true", help="Preview deletions without modifying disk")
    parser.add_argument("--permanent", action="store_true", help="Permanently delete instead of moving to Trash")
    parser.add_argument("--from-json", help="Read target paths from a JSON array file")
    args = parser.parse_args()

    root_path = Path(args.root).resolve()
    target_paths = list(args.targets)

    if args.from_json:
        with open(args.from_json, "r") as f:
            target_paths.extend(json.load(f))

    if not target_paths:
        print("No targets specified. Use --help for usage.", file=sys.stderr)
        sys.exit(1)

    print(f"=== Space Explorer Cleanup ===")
    print(f"Root boundary: {root_path}")
    print(f"Mode: {'DRY RUN' if args.dry_run else ('PERMANENT REMOVAL' if args.permanent else 'MOVE TO TRASH')}")
    print("----------------------------------------")

    total_reclaimed = 0
    safe_targets = []

    for t in target_paths:
        target_path = Path(t).resolve()
        safe, reason = is_path_safe_to_delete(target_path, root_path)
        if not safe:
            print(f"SKIPPED (Unsafe): {t} -> {reason}")
            continue

        if not target_path.exists():
            print(f"SKIPPED (Missing): {t}")
            continue

        size, count = get_dir_size_and_count(target_path) if target_path.is_dir() else (target_path.stat().st_size, 1)
        safe_targets.append((str(target_path), size))
        print(f"TARGET: {target_path} ({format_bytes(size)}, {count} files)")
        total_reclaimed += size

    print("----------------------------------------")
    print(f"Total space to reclaim: {format_bytes(total_reclaimed)} across {len(safe_targets)} targets.")

    if args.dry_run:
        print("\nDry run completed. No files were removed.")
        sys.exit(0)

    # Perform deletion
    deleted_count = 0
    for path_str, size in safe_targets:
        res = delete_target(path_str, str(root_path), use_trash=not args.permanent)
        if res.get("success"):
            print(f"SUCCESS: Reclaimed {format_bytes(res.get('bytes_reclaimed', 0))} from {path_str}")
            deleted_count += 1
        else:
            print(f"FAILED: {path_str} -> {res.get('error')}", file=sys.stderr)

    print(f"\nCleanup finished: {deleted_count}/{len(safe_targets)} targets removed.")


if __name__ == "__main__":
    main()
