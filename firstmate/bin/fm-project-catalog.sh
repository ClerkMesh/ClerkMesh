#!/usr/bin/env bash
# fm-project-catalog.sh - read-only public Project catalog projection.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
if [ "${1:---json}" != "--json" ] || [ "$#" -gt 1 ]; then
  echo "usage: fm-project-catalog.sh --json" >&2
  exit 2
fi
exec node "$SCRIPT_DIR/fm-project-catalog.mjs"
