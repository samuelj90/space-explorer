"""
Single responsibility: Package manager cache inspection and cleanup operations.
Loads cache definitions dynamically from lib/rules.py.
Cross-platform (macOS / Windows / Linux).
"""

from typing import Dict, List, Any
from pathlib import Path
import os
import shutil
import subprocess
import platform

from .rules import get_all_cache_rules


def get_dir_size(p: Path) -> int:
    total = 0
    try:
        if not p.exists():
            return 0
        for entry in os.scandir(p):
            try:
                if entry.is_file(follow_symlinks=False):
                    total += entry.stat(follow_symlinks=False).st_size
                elif entry.is_dir(follow_symlinks=False):
                    total += get_dir_size(Path(entry.path))
            except (OSError, PermissionError):
                continue
    except (OSError, PermissionError):
        pass
    return total


def scan_caches() -> List[Dict[str, Any]]:
    """Inspects all supported package caches declared in rules."""
    current_os = platform.system()
    cache_rules = get_all_cache_rules()
    results = []

    for meta in cache_rules:
        if "platform_only" in meta and meta["platform_only"] != current_os:
            continue

        raw_path = meta["path"]
        if "%LOCALAPPDATA%" in raw_path and "LOCALAPPDATA" in os.environ:
            resolved_path = Path(raw_path.replace("%LOCALAPPDATA%", os.environ["LOCALAPPDATA"]))
        else:
            resolved_path = Path(os.path.expanduser(raw_path)).resolve()

        exists = resolved_path.exists()
        size_bytes = get_dir_size(resolved_path) if exists else 0

        results.append({
            "id": meta["id"],
            "name": meta["name"],
            "category": meta["category"],
            "desc": meta["desc"],
            "path": str(resolved_path),
            "exists": exists,
            "size_bytes": size_bytes,
            "safe": meta.get("safe", True),
        })

    return results


def clean_cache(cache_id: str) -> Dict[str, Any]:
    """Cleans a single package cache by ID using official CLI command or directory purge."""
    cache_rules = {c["id"]: c for c in get_all_cache_rules()}
    if cache_id not in cache_rules:
        return {"id": cache_id, "success": False, "error": f"Unknown cache '{cache_id}'"}

    meta = cache_rules[cache_id]
    raw_path = meta["path"]
    if "%LOCALAPPDATA%" in raw_path and "LOCALAPPDATA" in os.environ:
        target_path = Path(raw_path.replace("%LOCALAPPDATA%", os.environ["LOCALAPPDATA"]))
    else:
        target_path = Path(os.path.expanduser(raw_path)).resolve()

    size_before = get_dir_size(target_path) if target_path.exists() else 0

    # 1. Try official CLI clean command if provided
    if meta.get("clean_cmd"):
        try:
            res = subprocess.run(meta["clean_cmd"], capture_output=True, text=True, timeout=60)
            if res.returncode == 0:
                size_after = get_dir_size(target_path) if target_path.exists() else 0
                return {
                    "id": cache_id,
                    "name": meta["name"],
                    "success": True,
                    "bytes_reclaimed": max(0, size_before - size_after),
                    "method": "cli"
                }
        except (subprocess.SubprocessError, FileNotFoundError):
            pass

    # 2. Filesystem directory clear fallback
    if target_path.exists():
        try:
            for item in target_path.iterdir():
                try:
                    if item.is_dir():
                        shutil.rmtree(item)
                    else:
                        item.unlink()
                except Exception:
                    continue
            size_after = get_dir_size(target_path)
            return {
                "id": cache_id,
                "name": meta["name"],
                "success": True,
                "bytes_reclaimed": max(0, size_before - size_after),
                "method": "filesystem"
            }
        except Exception as e:
            return {"id": cache_id, "name": meta["name"], "success": False, "error": str(e)}

    return {"id": cache_id, "name": meta["name"], "success": True, "bytes_reclaimed": 0, "method": "noop"}
