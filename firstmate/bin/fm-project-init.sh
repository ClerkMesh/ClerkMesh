#!/usr/bin/env bash
# Deterministically create and register one managed local-only Project.
# Usage: fm-project-init.sh <project-name> <description>
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
FM_ROOT=${FM_ROOT_OVERRIDE:-$(cd "$SCRIPT_DIR/.." && pwd -P)}
FM_HOME=${FM_HOME:-${FM_ROOT_OVERRIDE:-$FM_ROOT}}
DATA=${FM_DATA_OVERRIDE:-$FM_HOME/data}
PROJECTS=${FM_PROJECTS_OVERRIDE:-$FM_HOME/projects}
REGISTRY=$DATA/projects.md

fatal() { printf 'error: project init: %s\n' "$*" >&2; exit 1; }
[ "$#" -eq 2 ] || fatal 'usage: fm-project-init.sh <project-name> <description>'
NAME=$1
DESCRIPTION=$2
case "$NAME" in
  ''|.|..|*[!A-Za-z0-9._-]*) fatal "invalid project name: $NAME" ;;
esac
[ "${#NAME}" -le 128 ] || fatal 'project name exceeds 128 bytes'
case "$DESCRIPTION" in ''|*$'\n'*|*$'\r'*) fatal 'description must be one non-empty line' ;; esac
[ "${#DESCRIPTION}" -le 256 ] || fatal 'description exceeds 256 bytes'
command -v git >/dev/null 2>&1 || fatal 'git is unavailable'

[ -d "$DATA" ] && [ ! -L "$DATA" ] || fatal 'data root is unavailable or unsafe'
[ -d "$PROJECTS" ] && [ ! -L "$PROJECTS" ] || fatal 'managed projects root is unavailable or unsafe'
[ -f "$REGISTRY" ] && [ ! -L "$REGISTRY" ] || fatal 'project registry is unavailable or unsafe'
data_real=$(cd "$DATA" && pwd -P)
projects_real=$(cd "$PROJECTS" && pwd -P)
[ "$REGISTRY" = "$DATA/projects.md" ] && [ "$(cd "$(dirname "$REGISTRY")" && pwd -P)" = "$data_real" ] || fatal 'project registry is outside the data root'

# Validate the entire authority before creating anything. Unknown state is never repaired here.
awk '
  NF == 0 { next }
  !match($0, /^- [A-Za-z0-9][A-Za-z0-9._-]* (\[[^]]+\] )?- .+$/) { exit 2 }
  { if (seen[$2]++) exit 3 }
' "$REGISTRY" || fatal 'project registry contains malformed or duplicate records'
if awk -v n="$NAME" '$1 == "-" && $2 == n { found=1 } END { exit !found }' "$REGISTRY"; then
  fatal "project already registered: $NAME"
fi
TARGET=$PROJECTS/$NAME
[ ! -e "$TARGET" ] && [ ! -L "$TARGET" ] || fatal "managed project path already exists: $TARGET"
[ -w "$DATA" ] && [ -w "$PROJECTS" ] && [ -w "$REGISTRY" ] || fatal 'project roots are not writable'

created=false
tmp=''
cleanup() { [ -z "$tmp" ] || rm -f "$tmp"; }
trap cleanup EXIT
if ! mkdir "$TARGET"; then fatal "cannot create managed project: $TARGET"; fi
created=true
if ! {
  printf '# %s\n\nLocal ClerkMesh project.\n' "$NAME" > "$TARGET/README.md"
  git -C "$TARGET" init -q -b main
  git -C "$TARGET" config user.name 'ClerkMesh'
  git -C "$TARGET" config user.email 'clerkmesh@local.invalid'
  git -C "$TARGET" add README.md
  GIT_AUTHOR_DATE='2000-01-01T00:00:00Z' GIT_COMMITTER_DATE='2000-01-01T00:00:00Z' \
    git -C "$TARGET" commit -qm 'Initial local project baseline'
}; then
  fatal "project initialization failed; retained incomplete path: $TARGET"
fi
[ "$(cd "$TARGET" && pwd -P)" = "$projects_real/$NAME" ] || fatal "created project escaped managed root; retained path: $TARGET"
[ -z "$(git -C "$TARGET" remote)" ] || fatal "new local project unexpectedly has remotes; retained path: $TARGET"

tmp=$(mktemp "$DATA/.projects.md.tmp.XXXXXX") || fatal "cannot stage registry; retained path: $TARGET"
cat "$REGISTRY" > "$tmp" || fatal "cannot copy registry; retained path: $TARGET"
printf -- '- %s [local-only] - %s\n' "$NAME" "$DESCRIPTION" >> "$tmp" || fatal "cannot stage registry entry; retained path: $TARGET"
chmod --reference="$REGISTRY" "$tmp" 2>/dev/null || chmod 600 "$tmp"
mv "$tmp" "$REGISTRY" || fatal "cannot publish registry; retained path: $TARGET"
tmp=''
printf '%s\tlocal-only\t%s\n' "$NAME" "$(git -C "$TARGET" rev-parse HEAD)"
