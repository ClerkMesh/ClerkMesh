#!/usr/bin/env bash
# fm-task-graph.sh - read-only public Task graph projection.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "${1:---json}" != "--json" ] || [ "$#" -gt 1 ]; then
  echo "usage: fm-task-graph.sh --json" >&2
  exit 2
fi
command -v jq >/dev/null 2>&1 || { echo "fm-task-graph: jq not found" >&2; exit 1; }

"$SCRIPT_DIR/fm-fleet-snapshot.sh" --json | jq -f "$SCRIPT_DIR/fm-task-graph.jq"
