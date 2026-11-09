import sys
import json
import urllib.parse
from pathlib import Path
from http.server import SimpleHTTPRequestHandler
import socketserver

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from lib.scanner import scan_workspace
from lib.cleaner import delete_target
from lib.cache_cleaners import scan_caches, clean_cache

UI_DIR = ROOT_DIR / "ui"
DEFAULT_WORKSPACE = ROOT_DIR.parent.resolve()


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
        print(f"Space Explorer Server running at http://127.0.0.1:{port}")
        print(f"Bound workspace: {DEFAULT_WORKSPACE}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3888
    run_server(port)
