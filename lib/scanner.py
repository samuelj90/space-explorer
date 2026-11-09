"""
Single responsibility: Scan directory trees, calculate sizes, and identify disposable artifacts.
Zero external dependencies, cross-platform (macOS / Windows).
"""

from typing import Dict, List, Generator, Any
from pathlib import Path
import os
import time

from .rules import classify_artifact, IGNORE_DIRS


def get_dir_size_and_count(dir_path: Path) -> tuple[int, int]:
    """Computes total size in bytes and file count for a directory path."""
    total_size = 0
    file_count = 0
    try:
        for entry in os.scandir(dir_path):
            try:
                if entry.is_file(follow_symlinks=False):
                    total_size += entry.stat(follow_symlinks=False).st_size
                    file_count += 1
                elif entry.is_dir(follow_symlinks=False):
                    sub_size, sub_count = get_dir_size_and_count(Path(entry.path))
                    total_size += sub_size
                    file_count += sub_count
            except (OSError, PermissionError):
                continue
    except (OSError, PermissionError):
        pass
    return total_size, file_count


def scan_workspace(root_path: str) -> Generator[Dict[str, Any], None, None]:
    """
    Traverses root_path discovering projects and disposable artifacts.
    Yields item summaries as they are discovered.
    """
    root = Path(root_path).resolve()
    if not root.exists():
        return

    # Yield projects (immediate child directories of root)
    try:
        top_entries = [p for p in root.iterdir() if p.is_dir() and not p.name.startswith('.')]
    except (OSError, PermissionError):
        return

    for project_dir in top_entries:
        project_name = project_dir.name
        artifacts: List[Dict[str, Any]] = []
        total_reclaimable_bytes = 0

        # Scan for disposable artifacts inside project
        for current_root, dirs, files in os.walk(project_dir):
            # Do not recurse into ignored directories (.git, etc.)
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

            for d in list(dirs):
                rule = classify_artifact(d, is_dir=True)
                if rule:
                    artifact_path = Path(current_root) / d
                    # Remove from dirs so os.walk does not traverse inside the artifact
                    dirs.remove(d)

                    size_bytes, count = get_dir_size_and_count(artifact_path)
                    try:
                        mtime = artifact_path.stat().st_mtime
                    except (OSError, PermissionError):
                        mtime = time.time()

                    total_reclaimable_bytes += size_bytes
                    artifacts.append({
                        "name": d,
                        "rel_path": str(artifact_path.relative_to(root)),
                        "abs_path": str(artifact_path),
                        "category": rule["category"],
                        "desc": rule["desc"],
                        "size_bytes": size_bytes,
                        "file_count": count,
                        "mtime": mtime,
                    })

        yield {
            "type": "project",
            "name": project_name,
            "abs_path": str(project_dir),
            "rel_path": project_name,
            "reclaimable_bytes": total_reclaimable_bytes,
            "artifact_count": len(artifacts),
            "artifacts": artifacts,
        }
