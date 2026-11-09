from typing import Dict, Any
from pathlib import Path
import os
import shutil
import platform
import subprocess

from .rules import classify_artifact


def is_path_safe_to_delete(target_path: Path, root_workspace: Path) -> tuple[bool, str]:
    resolved_target = target_path.resolve()
    resolved_root = root_workspace.resolve()

    try:
        resolved_target.relative_to(resolved_root)
    except ValueError:
        return False, f"Path {target_path} is outside allowed root {root_workspace}"

    if resolved_target == resolved_root:
        return False, "Cannot delete workspace root"

    if resolved_target.parent == resolved_root:
        return False, "Cannot delete entire project folder, only expendable sub-artifacts"

    rule = classify_artifact(resolved_target.name, is_dir=resolved_target.is_dir())
    if not rule or not rule.get("safe_to_delete"):
        return False, f"Target '{resolved_target.name}' does not match allowed expendable artifact rules"

    return True, "Safe"


def delete_target(target_str: str, root_str: str, use_trash: bool = True) -> Dict[str, Any]:
    target_path = Path(target_str)
    root_path = Path(root_str)

    if not target_path.exists():
        return {
            "path": target_str,
            "success": False,
            "error": "Path does not exist",
            "bytes_reclaimed": 0
        }

    is_safe, reason = is_path_safe_to_delete(target_path, root_path)
    if not is_safe:
        return {
            "path": target_str,
            "success": False,
            "error": f"Safety check failed: {reason}",
            "bytes_reclaimed": 0
        }

    from .scanner import get_dir_size_and_count
    size_bytes, _ = get_dir_size_and_count(target_path) if target_path.is_dir() else (target_path.stat().st_size, 1)

    try:
        if use_trash:
            if platform.system() == "Darwin":
                script = 'on run argv\ntell application "Finder" to delete POSIX file (item 1 of argv)\nend run'
                res = subprocess.run(
                    ["osascript", "-e", script, str(target_path.resolve())],
                    capture_output=True,
                    text=True
                )
                if res.returncode == 0:
                    return {"path": target_str, "success": True, "bytes_reclaimed": size_bytes, "mode": "trash"}
                return {"path": target_str, "success": False, "error": f"Failed to move to Trash: {res.stderr.strip()}", "bytes_reclaimed": 0}
            
            return {"path": target_str, "success": False, "error": "System Trash is not supported on this platform without permanent removal flag", "bytes_reclaimed": 0}
        
        if target_path.is_dir():
            shutil.rmtree(target_path)
        else:
            target_path.unlink()
        return {"path": target_str, "success": True, "bytes_reclaimed": size_bytes, "mode": "permanent"}
    except Exception as e:
        return {
            "path": target_str,
            "success": False,
            "error": str(e),
            "bytes_reclaimed": 0
        }
