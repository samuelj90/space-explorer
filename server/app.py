import sys
import json
import os
import urllib.parse
from pathlib import Path
from http.server import SimpleHTTPRequestHandler
import socketserver

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from lib.scanner import scan_workspace
from lib.cleaner import delete_target
from lib.cache_cleaners import scan_caches, clean_cache
from lib.rules import (
    get_rules_overview,
    add_custom_artifact_rule,
    delete_custom_artifact_rule,
    save_user_rules,
)

UI_DIR = Path(os.environ.get("SPACE_EXPLORER_UI_DIR", ROOT_DIR / "ui-dist")).resolve()
DEFAULT_WORKSPACE = Path(os.environ.get("SPACE_EXPLORER_WORKSPACE", ROOT_DIR.parent)).resolve()


class SpaceExplorerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(UI_DIR), **kwargs)

    def log_message(self, format, *args):
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/api/scan":
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()

            for item in scan_workspace(str(DEFAULT_WORKSPACE)):
                line = json.dumps(item) + "\n"
                try:
                    self.wfile.write(line.encode("utf-8"))
                    self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError):
                    break
            return

        if parsed.path == "/api/caches":
            caches = scan_caches()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"caches": caches}).encode("utf-8"))
            return

        if parsed.path == "/api/info":
            import shutil
            total, used, free = shutil.disk_usage(str(DEFAULT_WORKSPACE))
            data = {
                "workspace": str(DEFAULT_WORKSPACE),
                "disk": {
                    "total_bytes": total,
                    "used_bytes": used,
                    "free_bytes": free,
                }
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode("utf-8"))
            return

        if parsed.path == "/api/rules":
            overview = get_rules_overview()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(overview).encode("utf-8"))
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        content_type = self.headers.get("Content-Type", "")

        if not content_type.startswith("application/json"):
            self.send_error(415, "Unsupported Media Type: expected application/json")
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8")
        data = json.loads(body or "{}")

        if parsed.path == "/api/rules":
            action = data.get("action", "")
            if action == "add_artifact":
                rule_data = data.get("rule", {})
                try:
                    new_rule = add_custom_artifact_rule(rule_data)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(
                        json.dumps(
                            {"success": True, "rule": new_rule, "overview": get_rules_overview()}
                        ).encode("utf-8")
                    )
                except Exception as e:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(
                        json.dumps({"success": False, "error": str(e)}).encode("utf-8")
                    )
                return

            if action == "delete_artifact":
                name = data.get("name", "")
                deleted = delete_custom_artifact_rule(name)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(
                    json.dumps({"success": deleted, "overview": get_rules_overview()}).encode("utf-8")
                )
                return

            if action == "save_all_user_rules":
                user_rules = data.get("user_rules", {})
                saved = save_user_rules(user_rules)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(
                    json.dumps({"success": saved, "overview": get_rules_overview()}).encode("utf-8")
                )
                return

            self.send_error(400, "Invalid action for /api/rules")
            return

        if parsed.path == "/api/clean":
            targets = data.get("targets", [])
            use_trash = bool(data.get("use_trash", True))

            results = []
            for t in targets:
                res = delete_target(t, str(DEFAULT_WORKSPACE), use_trash=use_trash)
                results.append(res)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"results": results}).encode("utf-8"))
            return

        if parsed.path == "/api/clean-caches":
            cache_ids = data.get("cache_ids", [])
            results = []
            for cid in cache_ids:
                res = clean_cache(cid)
                results.append(res)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"results": results}).encode("utf-8"))
            return

        self.send_error(404, "Not Found")


def run_server(port=3888):
    server_address = ("127.0.0.1", port)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(server_address, SpaceExplorerHandler) as httpd:
        actual_port = httpd.server_address[1]
        print(f"SPACE_EXPLORER_READY:{actual_port}", flush=True)
        print(f"Space Explorer Server running at http://127.0.0.1:{actual_port}", flush=True)
        print(f"Bound workspace: {DEFAULT_WORKSPACE}", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3888
    run_server(port)
