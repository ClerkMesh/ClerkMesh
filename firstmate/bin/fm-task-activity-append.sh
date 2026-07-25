#!/usr/bin/env bash
# Append one Firstmate-owned structured Task activity event.
set -eu
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/fm-task-activity-append.mjs" "$@"
