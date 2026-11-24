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


USER_RULES_FILE = Path(os.path.expanduser("~/.space-explorer-rules.json"))


def get_user_rules_path() -> Path:
    return USER_RULES_FILE


def load_builtin_rules() -> Dict[str, Any]:
    """Loads default builtin rules from rules.json."""
    if RULES_FILE.exists():
        try:
            with open(RULES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"project_artifacts": [], "package_caches": []}


def load_user_rules() -> Dict[str, Any]:
    """Loads user custom rules from ~/.space-explorer-rules.json"""
    user_file = get_user_rules_path()
    if user_file.exists():
        try:
            with open(user_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {
                    "project_artifacts": data.get("project_artifacts", []),
                    "package_caches": data.get("package_caches", []),
                }
        except Exception:
            pass
    return {"project_artifacts": [], "package_caches": []}


def save_user_rules(user_rules: Dict[str, Any]) -> bool:
    """Saves user custom rules to ~/.space-explorer-rules.json and reloads active rules."""
    user_file = get_user_rules_path()
    try:
        user_file.parent.mkdir(parents=True, exist_ok=True)
        with open(user_file, "w", encoding="utf-8") as f:
            json.dump(user_rules, f, indent=2)
        reload_rules()
        return True
    except Exception:
        return False


def load_rules() -> Dict[str, Any]:
    """Loads default rules and merges any user-defined custom rules from ~/.space-explorer-rules.json"""
    rules: Dict[str, Any] = {"project_artifacts": [], "package_caches": []}
    builtin = load_builtin_rules()
    rules["project_artifacts"].extend(builtin.get("project_artifacts", []))
    rules["package_caches"].extend(builtin.get("package_caches", []))

    user_rules = load_user_rules()
    rules["project_artifacts"].extend(user_rules.get("project_artifacts", []))
    rules["package_caches"].extend(user_rules.get("package_caches", []))
    return rules


_LOADED_RULES: Dict[str, Any] = load_rules()
_ARTIFACTS_MAP: Dict[str, Dict[str, Any]] = {
    item["name"]: item for item in _LOADED_RULES.get("project_artifacts", [])
}


def reload_rules() -> Dict[str, Any]:
    """Forces reloading of rules from disk into the runtime cache."""
    global _LOADED_RULES, _ARTIFACTS_MAP
    _LOADED_RULES = load_rules()
    _ARTIFACTS_MAP = {
        item["name"]: item for item in _LOADED_RULES.get("project_artifacts", [])
    }
    return _LOADED_RULES


def get_all_artifact_rules() -> List[Dict[str, Any]]:
    return _LOADED_RULES.get("project_artifacts", [])


def get_all_cache_rules() -> List[Dict[str, Any]]:
    return _LOADED_RULES.get("package_caches", [])


def get_rules_overview() -> Dict[str, Any]:
    """Returns overview of all rules with source annotations (builtin vs custom)."""
    user_rules = load_user_rules()
    custom_artifact_names = {r["name"] for r in user_rules.get("project_artifacts", [])}
    custom_cache_ids = {r.get("id") for r in user_rules.get("package_caches", [])}

    artifacts = []
    for r in get_all_artifact_rules():
        rule_copy = dict(r)
        rule_copy["is_custom"] = r["name"] in custom_artifact_names
        artifacts.append(rule_copy)

    caches = []
    for c in get_all_cache_rules():
        cache_copy = dict(c)
        cache_copy["is_custom"] = c.get("id") in custom_cache_ids
        caches.append(cache_copy)

    return {
        "project_artifacts": artifacts,
        "package_caches": caches,
        "custom_rules_path": str(get_user_rules_path()),
        "user_rules": user_rules,
    }


def add_custom_artifact_rule(rule_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Adds or updates a custom artifact rule and persists to user rules file."""
    user_rules = load_user_rules()
    name = rule_dict.get("name", "").strip()
    if not name:
        raise ValueError("Rule name cannot be empty")

    new_rule = {
        "name": name,
        "category": rule_dict.get("category", "Custom").strip() or "Custom",
        "desc": rule_dict.get("desc", f"Custom rule for {name}").strip(),
        "safe_to_delete": bool(rule_dict.get("safe_to_delete", True)),
        "is_dir": bool(rule_dict.get("is_dir", True)),
    }

    # Remove existing custom rule with same name if any
    user_rules["project_artifacts"] = [
        r for r in user_rules["project_artifacts"] if r.get("name") != name
    ]
    user_rules["project_artifacts"].append(new_rule)
    save_user_rules(user_rules)
    return new_rule


def delete_custom_artifact_rule(name: str) -> bool:
    """Removes a custom artifact rule by name."""
    user_rules = load_user_rules()
    original_count = len(user_rules["project_artifacts"])
    user_rules["project_artifacts"] = [
        r for r in user_rules["project_artifacts"] if r.get("name") != name
    ]
    if len(user_rules["project_artifacts"]) < original_count:
        save_user_rules(user_rules)
        return True
    return False


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
