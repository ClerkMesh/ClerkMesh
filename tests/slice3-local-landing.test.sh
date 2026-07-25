#!/usr/bin/env bash
# Contract coverage for authoritative local-only review and fast-forward landing.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-local-landing.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
HOME_ROOT="$TMP/home"
PROJECT="$HOME_ROOT/projects/demo"
STATE="$HOME_ROOT/state"
mkdir -p "$HOME_ROOT/data" "$HOME_ROOT/projects" "$STATE"
printf '%s\n' '- demo [local-only] - landing fixture' > "$HOME_ROOT/data/projects.md"

git init -q -b main "$PROJECT"
git -C "$PROJECT" config user.name Test
git -C "$PROJECT" config user.email test@example.invalid
printf '# Demo\n' > "$PROJECT/README.md"
git -C "$PROJECT" add README.md
git -C "$PROJECT" commit -qm baseline
BASE=$(git -C "$PROJECT" rev-parse HEAD)

make_task() {
  local id=$1 wt="$TMP/$1-wt"
  git -C "$PROJECT" worktree add -qb "fm/$id" "$wt" main
  printf 'project=%s\nworktree=%s\nmode=local-only\ntype=ship\n' "$PROJECT" "$wt" > "$STATE/$id.meta"
  printf '%s\n' "$wt"
}

TASK=land-ok
WT=$(make_task "$TASK")
printf 'accepted result\n' > "$WT/result.txt"
git -C "$WT" add result.txt
git -C "$WT" commit -qm 'deliver accepted result'
TIP=$(git -C "$WT" rev-parse HEAD)

REVIEW=$(FM_ROOT_OVERRIDE="$ROOT/firstmate" FM_HOME="$HOME_ROOT" FM_STATE_OVERRIDE="$STATE" \
  "$ROOT/firstmate/bin/fm-review-diff.sh" "$TASK")
grep -F 'diff base: main' <<<"$REVIEW" >/dev/null
grep -F 'result.txt' <<<"$REVIEW" >/dev/null
grep -F '+accepted result' <<<"$REVIEW" >/dev/null

LAND=$(FM_ROOT_OVERRIDE="$ROOT/firstmate" FM_HOME="$HOME_ROOT" FM_STATE_OVERRIDE="$STATE" \
  "$ROOT/firstmate/bin/fm-merge-local.sh" "$TASK")
grep -F "merged fm/$TASK into local main" <<<"$LAND" >/dev/null
[ "$(git -C "$PROJECT" rev-parse main)" = "$TIP" ] || { echo 'landing did not advance main to reviewed tip' >&2; exit 1; }
git -C "$PROJECT" merge-base --is-ancestor "$BASE" main || { echo 'landing was not a fast-forward' >&2; exit 1; }
[ -z "$(git -C "$PROJECT" status --porcelain)" ] || { echo 'landing left Project dirty' >&2; exit 1; }

TASK=land-diverged
WT=$(make_task "$TASK")
printf 'worker\n' > "$WT/worker.txt"
git -C "$WT" add worker.txt
git -C "$WT" commit -qm worker
printf 'captain race\n' > "$PROJECT/race.txt"
git -C "$PROJECT" add race.txt
git -C "$PROJECT" commit -qm race
BEFORE=$(git -C "$PROJECT" rev-parse main)
if FM_ROOT_OVERRIDE="$ROOT/firstmate" FM_HOME="$HOME_ROOT" FM_STATE_OVERRIDE="$STATE" \
  "$ROOT/firstmate/bin/fm-merge-local.sh" "$TASK" >"$TMP/diverged.out" 2>&1; then
  echo 'diverged landing unexpectedly succeeded' >&2
  exit 1
fi
grep -F 'REFUSED:' "$TMP/diverged.out" >/dev/null
[ "$(git -C "$PROJECT" rev-parse main)" = "$BEFORE" ] || { echo 'refused landing moved main' >&2; exit 1; }

printf 'ok - local-only review binds the full diff and landing is clean fast-forward-only\n'
