"""
Single responsibility: Rule registry and loader for expendable project artifacts and caches.
Loads declarations from rules.json and allows custom user rule extension.
Zero external dependencies, cross-platform.
"""

from typing import Dict, List, Optional, Any
from pathlib import Path
import json
import os

RULES_FILE = Path(__file__).resolve().parent / "rules.json"

IGNORE_DIRS = {
    ".git",
    ".hg",
    ".svn",
}


def load_rules() -> Dict[str, Any]:
    """Loads default rules and merges any user-defined custom rules from ~/.space-explorer-rules.json"""
    rules: Dict[str, Any] = {"project_artifacts": [], "package_caches": []}

    if RULES_FILE.exists():
        try:
            with open(RULES_FILE, "r", encoding="utf-8") as f:
                rules = json.load(f)
        except Exception:
            pass

    # Optional user extension file: ~/.space-explorer-rules.json
    user_rules_file = Path(os.path.expanduser("~/.space-explorer-rules.json"))
    if user_rules_file.exists():
        try:
            with open(user_rules_file, "r", encoding="utf-8") as f:
                user_rules = json.load(f)
                rules["project_artifacts"].extend(user_rules.get("project_artifacts", []))
                rules["package_caches"].extend(user_rules.get("package_caches", []))
        except Exception:
            pass

    return rules


_LOADED_RULES = load_rules()
_ARTIFACTS_MAP: Dict[str, Dict[str, Any]] = {
    item["name"]: item for item in _LOADED_RULES.get("project_artifacts", [])
}


def get_all_artifact_rules() -> List[Dict[str, Any]]:
    return _LOADED_RULES.get("project_artifacts", [])


def get_all_cache_rules() -> List[Dict[str, Any]]:
    return _LOADED_RULES.get("package_caches", [])


def classify_artifact(name: str, is_dir: bool = True) -> Optional[Dict[str, Any]]:
    """Checks if a directory or file matches known expendable rules."""
    rule = _ARTIFACTS_MAP.get(name)
    if rule and rule.get("is_dir", True) == is_dir:
        return {
            "name": name,
            "category": rule["category"],
            "desc": rule["desc"],
            "safe_to_delete": rule.get("safe_to_delete", True),
        }
    return None
