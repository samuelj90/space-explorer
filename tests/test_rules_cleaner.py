import unittest
from pathlib import Path
import tempfile
import shutil

from lib.rules import classify_artifact, load_rules
from lib.cleaner import is_path_safe_to_delete, delete_target


class TestRulesAndCleaner(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.root = Path(self.temp_dir)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_classify_known_artifacts(self):
        self.assertIsNotNone(classify_artifact("node_modules", is_dir=True))
        self.assertIsNotNone(classify_artifact("target", is_dir=True))
        self.assertIsNotNone(classify_artifact(".venv", is_dir=True))
        self.assertIsNone(classify_artifact("src", is_dir=True))
        self.assertIsNone(classify_artifact("package.json", is_dir=False))

    def test_prevent_workspace_root_deletion(self):
        safe, reason = is_path_safe_to_delete(self.root, self.root)
        self.assertFalse(safe)

    def test_prevent_entire_project_deletion(self):
        project_dir = self.root / "my-project"
        project_dir.mkdir()
        safe, reason = is_path_safe_to_delete(project_dir, self.root)
        self.assertFalse(safe)

    def test_prevent_arbitrary_folder_deletion(self):
        src_dir = self.root / "my-project" / "src"
        src_dir.mkdir(parents=True)
        safe, reason = is_path_safe_to_delete(src_dir, self.root)
        self.assertFalse(safe)

    def test_allow_expendable_artifact_deletion(self):
        node_modules = self.root / "my-project" / "node_modules"
        node_modules.mkdir(parents=True)
        (node_modules / "dummy.txt").write_text("test")
        safe, reason = is_path_safe_to_delete(node_modules, self.root)
        self.assertTrue(safe)

        res = delete_target(str(node_modules), str(self.root), use_trash=False)
        self.assertTrue(res["success"])
        self.assertFalse(node_modules.exists())


if __name__ == "__main__":
    unittest.main()
