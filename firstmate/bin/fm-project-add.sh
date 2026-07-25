#!/usr/bin/env bash
# Clone and atomically register one existing Project after mode-specific readiness.
# Usage: fm-project-add.sh <source-url> <project-name> <description> <local-only|direct-PR|no-mistakes> [on|off]
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
FM_ROOT=${FM_ROOT_OVERRIDE:-$(cd "$SCRIPT_DIR/.." && pwd -P)}
FM_HOME=${FM_HOME:-${FM_ROOT_OVERRIDE:-$FM_ROOT}}
DATA=${FM_DATA_OVERRIDE:-$FM_HOME/data}
PROJECTS=${FM_PROJECTS_OVERRIDE:-$FM_HOME/projects}
REGISTRY=$DATA/projects.md
fatal() { printf 'error: project add: %s\n' "$*" >&2; exit 1; }

[ "$#" -ge 4 ] && [ "$#" -le 5 ] || fatal 'usage: fm-project-add.sh <source-url> <project-name> <description> <local-only|direct-PR|no-mistakes> [on|off]'
SOURCE=$1 NAME=$2 DESCRIPTION=$3 MODE=$4 YOLO=${5:-off}
case "$NAME" in ''|.|..|*[!A-Za-z0-9._-]*) fatal "invalid project name: $NAME" ;; esac
[ "${#NAME}" -le 128 ] || fatal 'project name exceeds 128 bytes'
case "$DESCRIPTION" in ''|*$'\n'*|*$'\r'*) fatal 'description must be one non-empty line' ;; esac
[ "${#DESCRIPTION}" -le 256 ] || fatal 'description exceeds 256 bytes'
case "$MODE" in local-only|direct-PR|no-mistakes) ;; *) fatal "invalid delivery mode: $MODE" ;; esac
case "$YOLO" in on|off) ;; *) fatal "invalid yolo setting: $YOLO" ;; esac
[ -n "$SOURCE" ] || fatal 'source URL is empty'
command -v git >/dev/null 2>&1 || fatal 'git is unavailable'
[ -d "$DATA" ] && [ ! -L "$DATA" ] || fatal 'data root is unavailable or unsafe'
[ -d "$PROJECTS" ] && [ ! -L "$PROJECTS" ] || fatal 'managed projects root is unavailable or unsafe'
[ -f "$REGISTRY" ] && [ ! -L "$REGISTRY" ] || fatal 'project registry is unavailable or unsafe'
projects_real=$(cd "$PROJECTS" && pwd -P)
awk 'NF == 0 { next } !match($0, /^- [A-Za-z0-9][A-Za-z0-9._-]* (\[[^]]+\] )?- .+$/) { exit 2 } { if (seen[$2]++) exit 3 }' "$REGISTRY" \
  || fatal 'project registry contains malformed or duplicate records'
if awk -v n="$NAME" '$1 == "-" && $2 == n { found=1 } END { exit !found }' "$REGISTRY"; then fatal "project already registered: $NAME"; fi
TARGET=$PROJECTS/$NAME
[ ! -e "$TARGET" ] && [ ! -L "$TARGET" ] || fatal "managed project path already exists: $TARGET"

stage_dir=$(mktemp -d "$DATA/.project-add.XXXXXX") || fatal 'cannot stage project registration'
published=false
cleanup() {
  rm -rf "$stage_dir"
  if [ "$published" = false ] && [ -d "$TARGET" ] && [ ! -L "$TARGET" ]; then rm -rf "$TARGET"; fi
}
trap cleanup EXIT
if ! git clone -- "$SOURCE" "$TARGET" >/dev/null 2>&1; then fatal 'project clone failed'; fi
# Preserve the Captain-approved source identity even when Git URL rewriting is configured.
git -C "$TARGET" remote set-url origin "$SOURCE" || fatal 'cannot preserve project origin'
[ "$(cd "$TARGET" && pwd -P)" = "$projects_real/$NAME" ] || fatal 'cloned project escaped managed root'
git -C "$TARGET" rev-parse --verify 'HEAD^{commit}' >/dev/null 2>&1 || fatal 'cloned project has no baseline commit'
if [ "$MODE" = no-mistakes ]; then
  command -v no-mistakes >/dev/null 2>&1 || fatal 'no-mistakes delivery requires no-mistakes'
  (cd "$TARGET" && no-mistakes init >/dev/null 2>&1) || fatal 'no-mistakes initialization failed'
fi
opts=$MODE; [ "$YOLO" = off ] || opts="$opts +yolo"
candidate=$stage_dir/projects.md
cat "$REGISTRY" > "$candidate"
printf -- '- %s [%s] - %s\n' "$NAME" "$opts" "$DESCRIPTION" >> "$candidate"
chmod --reference="$REGISTRY" "$candidate" 2>/dev/null || chmod 600 "$candidate"
FM_HOME="$FM_HOME" FM_DATA_OVERRIDE="$stage_dir" FM_PROJECTS_OVERRIDE="$PROJECTS" \
  "$SCRIPT_DIR/fm-project-preflight.sh" "$NAME" >/dev/null || fatal "$MODE preflight refused; project and registry unchanged"
mv "$candidate" "$REGISTRY" || fatal 'cannot atomically publish project registry'
published=true
printf '%s\t%s\t%s\n' "$NAME" "$MODE" "$YOLO"
