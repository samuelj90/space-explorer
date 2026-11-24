import unittest
from pathlib import Path
import tempfile
import shutil
from unittest.mock import patch

from lib.rules import (
    classify_artifact,
    get_rules_overview,
    add_custom_artifact_rule,
    delete_custom_artifact_rule,
    save_user_rules,
    load_user_rules,
    reload_rules,
)


class TestRulesConfig(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.user_rules_path = Path(self.temp_dir) / "test_rules.json"
        self.patcher = patch("lib.rules.get_user_rules_path", return_value=self.user_rules_path)
        self.patcher.start()
        reload_rules()

    def tearDown(self):
        self.patcher.stop()
        reload_rules()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_overview_contains_builtin_rules(self):
        overview = get_rules_overview()
        self.assertIn("project_artifacts", overview)
        names = [r["name"] for r in overview["project_artifacts"]]
        self.assertIn("node_modules", names)
        self.assertIn("target", names)
        # Builtin rules should have is_custom False
        node_rule = next(r for r in overview["project_artifacts"] if r["name"] == "node_modules")
        self.assertFalse(node_rule["is_custom"])

    def test_add_and_classify_custom_rule(self):
        self.assertIsNone(classify_artifact(".custom_cache_dir", is_dir=True))

        rule = add_custom_artifact_rule({
            "name": ".custom_cache_dir",
            "category": "Custom Cache",
            "desc": "Temporary compilation cache",
            "is_dir": True,
            "safe_to_delete": True
        })

        self.assertEqual(rule["name"], ".custom_cache_dir")
        classified = classify_artifact(".custom_cache_dir", is_dir=True)
        self.assertIsNotNone(classified)
        self.assertEqual(classified["category"], "Custom Cache")

        overview = get_rules_overview()
        custom_rule = next(r for r in overview["project_artifacts"] if r["name"] == ".custom_cache_dir")
        self.assertTrue(custom_rule["is_custom"])

    def test_delete_custom_rule(self):
        add_custom_artifact_rule({
            "name": "coverage_dir",
            "category": "Testing",
            "desc": "Code coverage output",
            "is_dir": True,
        })
        self.assertIsNotNone(classify_artifact("coverage_dir", is_dir=True))

        deleted = delete_custom_artifact_rule("coverage_dir")
        self.assertTrue(deleted)
        self.assertIsNone(classify_artifact("coverage_dir", is_dir=True))

    def test_save_all_user_rules(self):
        user_rules = {
            "project_artifacts": [
                {
                    "name": ".turbo",
                    "category": "Monorepo",
                    "desc": "Turborepo build cache",
                    "is_dir": True,
                    "safe_to_delete": True
                }
            ],
            "package_caches": []
        }
        res = save_user_rules(user_rules)
        self.assertTrue(res)

        loaded = load_user_rules()
        self.assertEqual(len(loaded["project_artifacts"]), 1)
        self.assertEqual(loaded["project_artifacts"][0]["name"], ".turbo")
        self.assertIsNotNone(classify_artifact(".turbo", is_dir=True))


if __name__ == "__main__":
    unittest.main()
