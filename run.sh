#!/usr/bin/env bash
set -e

PORT=${1:-3888}
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "Starting Space Explorer on http://127.0.0.1:$PORT ..."
python3 "$DIR/server/app.py" "$PORT" &
SERVER_PID=$!

sleep 1

# Open in default browser (macOS 'open', Linux 'xdg-open')
if command -v open >/dev/null 2>&1; then
    open "http://127.0.0.1:$PORT"
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://127.0.0.1:$PORT"
fi

wait $SERVER_PID
