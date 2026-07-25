#!/usr/bin/env bash
# Atomically change the delivery mode used only by future Task dispatches.
# Usage: fm-project-mode-set.sh <project-name> <local-only|direct-PR|no-mistakes>
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
FM_ROOT=${FM_ROOT_OVERRIDE:-$(cd "$SCRIPT_DIR/.." && pwd -P)}
FM_HOME=${FM_HOME:-${FM_ROOT_OVERRIDE:-$FM_ROOT}}
DATA=${FM_DATA_OVERRIDE:-$FM_HOME/data}
PROJECTS=${FM_PROJECTS_OVERRIDE:-$FM_HOME/projects}
REGISTRY=$DATA/projects.md
fatal() { printf 'error: project mode: %s\n' "$*" >&2; exit 1; }

[ "$#" -eq 2 ] || fatal 'usage: fm-project-mode-set.sh <project-name> <local-only|direct-PR|no-mistakes>'
NAME=$1
MODE=$2
case "$NAME" in ''|.|..|*[!A-Za-z0-9._-]*) fatal "invalid project name: $NAME" ;; esac
case "$MODE" in local-only|direct-PR|no-mistakes) ;; *) fatal "invalid delivery mode: $MODE" ;; esac
[ -d "$DATA" ] && [ ! -L "$DATA" ] || fatal 'data root is unavailable or unsafe'
[ -f "$REGISTRY" ] && [ ! -L "$REGISTRY" ] || fatal 'project registry is unavailable or unsafe'
[ -w "$DATA" ] && [ -w "$REGISTRY" ] || fatal 'project registry is not writable'

# Refuse malformed authority and preserve the existing yolo setting and description.
awk '
  NF == 0 { next }
  !match($0, /^- [A-Za-z0-9][A-Za-z0-9._-]* (\[[^]]+\] )?- .+$/) { exit 2 }
  { if (seen[$2]++) exit 3 }
' "$REGISTRY" || fatal 'project registry contains malformed or duplicate records'
count=$(awk -v n="$NAME" '$1 == "-" && $2 == n { nfound++ } END { print nfound + 0 }' "$REGISTRY")
[ "$count" -eq 1 ] || fatal "project $NAME must have exactly one registry entry"
read -r OLD_MODE YOLO <<EOF
$(FM_HOME="$FM_HOME" FM_DATA_OVERRIDE="$DATA" "$SCRIPT_DIR/fm-project-mode.sh" "$NAME")
EOF

stage_dir=$(mktemp -d "$DATA/.project-mode.XXXXXX") || fatal 'cannot stage project mode'
cleanup() { rm -rf "$stage_dir"; }
trap cleanup EXIT
candidate=$stage_dir/projects.md
awk -v n="$NAME" -v mode="$MODE" -v yolo="$YOLO" '
  $1 == "-" && $2 == n {
    rest=$0; sub(/^- [^ ]+ (\[[^]]+\] )?/, "", rest)
    opts=mode (yolo == "on" ? " +yolo" : "")
    print "- " n " [" opts "] " rest
    next
  }
  { print }
' "$REGISTRY" > "$candidate"
chmod --reference="$REGISTRY" "$candidate" 2>/dev/null || chmod 600 "$candidate"

# Target-mode readiness is checked against the staged authority before publication.
FM_HOME="$FM_HOME" FM_DATA_OVERRIDE="$stage_dir" FM_PROJECTS_OVERRIDE="$PROJECTS" \
  "$SCRIPT_DIR/fm-project-preflight.sh" "$NAME" >/dev/null || fatal "preflight refused $MODE mode; registry unchanged"
mv "$candidate" "$REGISTRY" || fatal 'cannot atomically publish project mode'
printf '%s\t%s\t%s\n' "$NAME" "$MODE" "$YOLO"
