#!/usr/bin/env bash
# Contract coverage for fail-closed local-only teardown after authoritative landing.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-local-teardown.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
HOME_ROOT="$TMP/home"
PROJECT="$HOME_ROOT/projects/demo"
STATE="$HOME_ROOT/state"
SHIMS="$TMP/bin"
TASK=teardown-local
WT="$TMP/task-wt"
mkdir -p "$HOME_ROOT/data" "$HOME_ROOT/projects" "$STATE" "$SHIMS"
printf '%s\n' '- demo [local-only] - teardown fixture' > "$HOME_ROOT/data/projects.md"

git init -q -b main "$PROJECT"
git -C "$PROJECT" config user.name Test
git -C "$PROJECT" config user.email test@example.invalid
printf '# Demo\n' > "$PROJECT/README.md"
git -C "$PROJECT" add README.md
git -C "$PROJECT" commit -qm baseline
git -C "$PROJECT" worktree add -qb "fm/$TASK" "$WT" main
printf 'project=%s\nworktree=%s\nmode=local-only\ntype=ship\nkind=ship\n' \
  "$PROJECT" "$WT" > "$STATE/$TASK.meta"
printf 'accepted result\n' > "$WT/result.txt"
git -C "$WT" add result.txt
git -C "$WT" commit -qm 'deliver accepted result'
TIP=$(git -C "$WT" rev-parse HEAD)

# The isolated Treehouse seam performs only the requested worktree return. Its log
# proves teardown used the provider boundary rather than deleting the path itself.
cat > "$SHIMS/treehouse" <<'SHIM'
#!/usr/bin/env bash
set -euo pipefail
[ "$1" = return ] && [ "$2" = --force ] && [ -n "${3:-}" ]
printf '%s\n' "$*" >> "$TREEHOUSE_LOG"
git worktree remove --force "$3"
SHIM
chmod +x "$SHIMS/treehouse"
export TREEHOUSE_LOG="$TMP/treehouse.log"

if PATH="$SHIMS:$PATH" FM_ROOT_OVERRIDE="$ROOT/firstmate" FM_HOME="$HOME_ROOT" FM_STATE_OVERRIDE="$STATE" \
  "$ROOT/firstmate/bin/fm-teardown.sh" "$TASK" >"$TMP/refused.out" 2>&1; then
  echo 'teardown discarded unlanded local-only work' >&2
  exit 1
fi
grep -F 'REFUSED: local-only worktree' "$TMP/refused.out" >/dev/null
[ -d "$WT" ] || { echo 'refused teardown removed the worktree' >&2; exit 1; }
[ -f "$STATE/$TASK.meta" ] || { echo 'refused teardown removed task authority' >&2; exit 1; }
[ ! -e "$TREEHOUSE_LOG" ] || { echo 'refused teardown called Treehouse' >&2; exit 1; }

FM_ROOT_OVERRIDE="$ROOT/firstmate" FM_HOME="$HOME_ROOT" FM_STATE_OVERRIDE="$STATE" \
  "$ROOT/firstmate/bin/fm-merge-local.sh" "$TASK" >/dev/null
PATH="$SHIMS:$PATH" FM_ROOT_OVERRIDE="$ROOT/firstmate" FM_HOME="$HOME_ROOT" FM_STATE_OVERRIDE="$STATE" \
  "$ROOT/firstmate/bin/fm-teardown.sh" "$TASK" >"$TMP/teardown.out"

[ "$(git -C "$PROJECT" rev-parse main)" = "$TIP" ] || { echo 'teardown changed landed main' >&2; exit 1; }
[ ! -e "$WT" ] || { echo 'landed worktree survived teardown' >&2; exit 1; }
[ ! -e "$STATE/$TASK.meta" ] || { echo 'landed task metadata survived teardown' >&2; exit 1; }
grep -F "return --force $WT" "$TREEHOUSE_LOG" >/dev/null

printf 'ok - local-only teardown refuses unlanded work and removes only safely landed task state\n'
