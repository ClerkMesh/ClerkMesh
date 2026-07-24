#!/usr/bin/env bash
# Read-only dispatch preflight for one registered Project.
# Usage: fm-project-preflight.sh <project-name>
# Success prints: <local-only|direct-PR|no-mistakes> <on|off>
set -eu

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
FM_ROOT=${FM_ROOT_OVERRIDE:-$(cd "$SCRIPT_DIR/.." && pwd -P)}
FM_HOME=${FM_HOME:-${FM_ROOT_OVERRIDE:-$FM_ROOT}}
DATA=${FM_DATA_OVERRIDE:-$FM_HOME/data}
PROJECTS=${FM_PROJECTS_OVERRIDE:-$FM_HOME/projects}
NAME=${1:-}

fatal() { printf 'error: project preflight: %s\n' "$*" >&2; exit 1; }

[ "$#" -eq 1 ] && [ -n "$NAME" ] || fatal 'usage: fm-project-preflight.sh <project-name>'
case "$NAME" in
  .|..|*[!A-Za-z0-9._-]*) fatal "invalid project name: $NAME" ;;
esac

REGISTRY=$DATA/projects.md
[ -f "$REGISTRY" ] || fatal "project registry not found: $REGISTRY"
count=$(awk -v n="$NAME" '$1 == "-" && $2 == n { count++ } END { print count + 0 }' "$REGISTRY")
[ "$count" -eq 1 ] || fatal "project $NAME must have exactly one registry entry"

read -r MODE YOLO <<EOF
$(FM_HOME="$FM_HOME" FM_DATA_OVERRIDE="$DATA" "$SCRIPT_DIR/fm-project-mode.sh" "$NAME")
EOF
case "$MODE" in local-only|direct-PR|no-mistakes) ;; *) fatal "unsupported delivery mode for $NAME: $MODE" ;; esac
case "$YOLO" in on|off) ;; *) fatal "invalid yolo setting for $NAME" ;; esac

[ -d "$PROJECTS" ] || fatal "projects directory not found: $PROJECTS"
projects_real=$(cd "$PROJECTS" && pwd -P)
project=$PROJECTS/$NAME
[ -d "$project" ] && [ ! -L "$project" ] || fatal "project working tree not found: $project"
project_real=$(cd "$project" && pwd -P)
[ "$project_real" = "$projects_real/$NAME" ] || fatal "project resolves outside the managed projects directory: $project"
[ "$(git -C "$project_real" rev-parse --is-inside-work-tree 2>/dev/null || true)" = true ] \
  || fatal "project is not a Git working tree: $project_real"
[ "$(git -C "$project_real" rev-parse --is-bare-repository 2>/dev/null || true)" = false ] \
  || fatal "project is a bare Git repository: $project_real"
top=$(git -C "$project_real" rev-parse --show-toplevel 2>/dev/null || true)
[ -n "$top" ] && [ "$(cd "$top" && pwd -P)" = "$project_real" ] \
  || fatal "project path is not the Git working-tree root: $project_real"
git -C "$project_real" rev-parse --verify 'HEAD^{commit}' >/dev/null 2>&1 \
  || fatal "project has no baseline commit: $project_real"
branch=$(git -C "$project_real" symbolic-ref --quiet --short HEAD 2>/dev/null || true)
[ -n "$branch" ] || fatal "project has no checked-out default branch: $project_real"

if [ "$MODE" != local-only ]; then
  origin=$(git -C "$project_real" remote get-url origin 2>/dev/null) \
    || fatal "$MODE delivery requires an origin remote"
  case "$origin" in
    https://github.com/*/*|git@github.com:*/*|ssh://git@github.com/*/*) ;;
    *) fatal "$MODE delivery requires a GitHub origin remote" ;;
  esac
  command -v gh >/dev/null 2>&1 || fatal "$MODE delivery requires gh"
  command -v gh-axi >/dev/null 2>&1 || fatal "$MODE delivery requires gh-axi"
  GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 gh auth status >/dev/null 2>&1 \
    || fatal "$MODE delivery requires GitHub authentication"
fi

if [ "$MODE" = no-mistakes ]; then
  command -v no-mistakes >/dev/null 2>&1 || fatal 'no-mistakes delivery requires no-mistakes'
  (cd "$project_real" && no-mistakes doctor >/dev/null 2>&1) \
    || fatal 'no-mistakes delivery readiness check failed'
fi

printf '%s %s\n' "$MODE" "$YOLO"
