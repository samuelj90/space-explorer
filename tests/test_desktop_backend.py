import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.request

ROOT = Path(__file__).resolve().parent.parent


class TestDesktopBackend(unittest.TestCase):
    def test_workspace_override_applies_to_scan_and_cleanup(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            workspace = root / "workspace"
            artifact = workspace / "project" / "node_modules"
            artifact.mkdir(parents=True)
            (artifact / "file").write_text("test", encoding="utf-8")
            outside = root / "other" / "node_modules"
            outside.mkdir(parents=True)
            env = dict(os.environ, SPACE_EXPLORER_WORKSPACE=str(workspace))
            process = subprocess.Popen(
                [sys.executable, "-u", str(ROOT / "server" / "app.py"), "0"],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env,
            )
            try:
                lines = queue.Queue()
                threading.Thread(target=lambda: lines.put(process.stdout.readline()), daemon=True).start()
                line = lines.get(timeout=10)
                self.assertTrue(line.startswith("SPACE_EXPLORER_READY:"), line)
                port = int(line.split(":")[1])
                base = f"http://127.0.0.1:{port}"
                with urllib.request.urlopen(base + "/api/info", timeout=10) as response:
                    self.assertEqual(json.load(response)["workspace"], str(workspace.resolve()))
                with urllib.request.urlopen(base + "/api/scan", timeout=10) as response:
                    projects = [json.loads(line) for line in response if line.strip()]
                self.assertEqual([project["name"] for project in projects], ["project"])
                request = urllib.request.Request(
                    base + "/api/clean",
                    data=json.dumps({"targets": [str(outside), str(artifact)], "use_trash": False}).encode(),
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(request, timeout=10) as response:
                    results = json.load(response)["results"]
                self.assertFalse(results[0]["success"])
                self.assertTrue(outside.exists())
                self.assertTrue(results[1]["success"])
                self.assertFalse(artifact.exists())
            finally:
                process.terminate()
                process.communicate(timeout=10)


if __name__ == "__main__":
    unittest.main()
