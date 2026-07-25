#!/usr/bin/env bash
# fm-task-activity.sh - read-only public structured Task activity projection.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/fm-task-activity.mjs" "$@"
