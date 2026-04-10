#!/usr/bin/env bash
# Aura-Next — Start the Resource Monitor
# Usage:
#   ./start_monitor.sh          (waits for a 'start_monitoring' WS event)
#   ./start_monitor.sh <PID>    (starts monitoring that PID immediately)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/.venv"

if [[ ! -d "$VENV" ]]; then
  echo "[Aura-Next Monitor] Creating virtual environment…"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -r "$SCRIPT_DIR/requirements.txt"
fi

echo "[Aura-Next Monitor] Starting on ws://localhost:5001"
"$VENV/bin/python" "$SCRIPT_DIR/process_monitor.py" "$@"
