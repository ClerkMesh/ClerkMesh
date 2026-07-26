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
  local id=$1 yolo=${2:-off} checkout=${3:-branch} wt="$TMP/$1-wt"
  if [ "$checkout" = detached ]; then
    git -C "$PROJECT" worktree add -q --detach "$wt" main
  else
    git -C "$PROJECT" worktree add -qb "fm/$id" "$wt" main
  fi
  printf 'project=%s\nworktree=%s\nmode=local-only\nyolo=%s\ntype=ship\n' "$PROJECT" "$wt" "$yolo" > "$STATE/$id.meta"
  mkdir -p "$HOME_ROOT/data/$id"
  printf '%s\n' "$wt"
}

TASK=land-ok
WT=$(make_task "$TASK" off detached)
printf 'accepted result\n' > "$WT/result.txt"
git -C "$WT" add result.txt
git -C "$WT" commit -qm 'deliver accepted result'
TIP=$(git -C "$WT" rev-parse HEAD)

REVIEW=$(FM_ROOT_OVERRIDE="$ROOT/firstmate" FM_HOME="$HOME_ROOT" FM_STATE_OVERRIDE="$STATE" \
  "$ROOT/firstmate/bin/fm-review-diff.sh" "$TASK")
grep -F 'diff base: main' <<<"$REVIEW" >/dev/null
grep -F 'result.txt' <<<"$REVIEW" >/dev/null
grep -F '+accepted result' <<<"$REVIEW" >/dev/null

if FM_ROOT_OVERRIDE="$ROOT/firstmate" FM_HOME="$HOME_ROOT" FM_STATE_OVERRIDE="$STATE" \
  "$ROOT/firstmate/bin/fm-merge-local.sh" "$TASK" >"$TMP/unapproved.out" 2>&1; then
  echo 'yolo=off landing unexpectedly succeeded without Captain approval' >&2
  exit 1
fi
grep -F 'explicit Captain approval is required' "$TMP/unapproved.out" >/dev/null
[ "$(git -C "$PROJECT" rev-parse main)" = "$BASE" ] || { echo 'unapproved landing moved main' >&2; exit 1; }

LAND=$(FM_ROOT_OVERRIDE="$ROOT/firstmate" FM_HOME="$HOME_ROOT" FM_STATE_OVERRIDE="$STATE" \
  "$ROOT/firstmate/bin/fm-merge-local.sh" "$TASK" --captain-approved)
grep -F "merged fm/$TASK into local main" <<<"$LAND" >/dev/null
[ "$(git -C "$PROJECT" rev-parse main)" = "$TIP" ] || { echo 'landing did not advance main to reviewed tip' >&2; exit 1; }
git -C "$PROJECT" merge-base --is-ancestor "$BASE" main || { echo 'landing was not a fast-forward' >&2; exit 1; }
[ -z "$(git -C "$PROJECT" status --porcelain)" ] || { echo 'landing left Project dirty' >&2; exit 1; }
ACTIVITY="$HOME_ROOT/data/$TASK/activity.jsonl"
[ "$(wc -l < "$ACTIVITY" | tr -d ' ')" = 2 ] || { echo 'review and landing did not append exactly two activity events' >&2; exit 1; }
node -e '
const fs = require("fs");
const events = fs.readFileSync(process.argv[1], "utf8").trim().split("\n").map(JSON.parse);
if (events[0].cursor !== 1 || events[0].type !== "delivery-reviewed" || events[0].summary !== "Authoritative Task delivery diff reviewed") process.exit(1);
if (events[1].cursor !== 2 || events[1].type !== "landed" || events[1].summary !== "Task candidate landed by fast-forward") process.exit(1);
if (JSON.stringify(events[1].actor) !== JSON.stringify({type: "captain", id: "local"}) || "actor" in events[0]) process.exit(1);
if (events.some((event) => event.occurredAt !== null || Number.isNaN(Date.parse(event.observedAt)))) process.exit(1);
' "$ACTIVITY" || { echo 'review or landing activity event was malformed' >&2; exit 1; }

TASK=land-yolo
WT=$(make_task "$TASK" on)
printf 'automated result\n' > "$WT/automated.txt"
git -C "$WT" add automated.txt
git -C "$WT" commit -qm automated
FM_ROOT_OVERRIDE="$ROOT/firstmate" FM_HOME="$HOME_ROOT" FM_STATE_OVERRIDE="$STATE" \
  "$ROOT/firstmate/bin/fm-merge-local.sh" "$TASK" >/dev/null
node -e '
const event = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8").trim());
if (event.type !== "landed" || "actor" in event) process.exit(1);
' "$HOME_ROOT/data/$TASK/activity.jsonl" || { echo 'yolo landing falsely recorded a Captain actor' >&2; exit 1; }

TASK=land-diverged
WT=$(make_task "$TASK" on)
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
[ ! -e "$HOME_ROOT/data/$TASK/activity.jsonl" ] || { echo 'refused landing emitted false activity' >&2; exit 1; }

printf 'ok - local-only review binds the full diff and landing is clean fast-forward-only with structured activity\n'
