#!/usr/bin/env bash
# fm-herdr-agents.sh - read-only public Herdr Agent projection.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "${1:---json}" != "--json" ] || [ "$#" -gt 1 ]; then
  echo "usage: fm-herdr-agents.sh --json" >&2
  exit 2
fi
exec node "$SCRIPT_DIR/fm-herdr-agents.mjs"
