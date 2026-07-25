#!/usr/bin/env bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
HOME_ROOT=$(cd "$TMP" && pwd -P)
mkdir -p "$HOME_ROOT/state" "$HOME_ROOT/data/task-1"
CMD="$ROOT/firstmate/bin/fm-task-status.sh"

FM_HOME="$HOME_ROOT" "$CMD" --task task-1 --state working --summary "validation running"
[ "$(cat "$HOME_ROOT/state/task-1.status")" = "working: validation running" ] || { echo 'status was not accepted' >&2; exit 1; }
node -e '
const fs=require("fs"); const [event]=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse);
if(event.cursor!==1 || event.type!=="worker-status-observed" || event.occurredAt!==null || event.summary!=="Worker reported working: validation running") process.exit(1);
if(Number.isNaN(Date.parse(event.observedAt))) process.exit(1);
' "$HOME_ROOT/data/task-1/activity.jsonl" || { echo 'worker status activity was malformed' >&2; exit 1; }

if FM_HOME="$HOME_ROOT" "$CMD" --task task-1 --state done --summary $'bad\nsummary' >/dev/null 2>&1; then
  echo 'multiline status was accepted' >&2; exit 1
fi
[ "$(wc -l < "$HOME_ROOT/state/task-1.status" | tr -d ' ')" = 1 ] || { echo 'refused status changed status log' >&2; exit 1; }
[ "$(wc -l < "$HOME_ROOT/data/task-1/activity.jsonl" | tr -d ' ')" = 1 ] || { echo 'refused status emitted activity' >&2; exit 1; }

ln -s "$TMP/outside" "$HOME_ROOT/state/linked.status"
mkdir -p "$HOME_ROOT/data/linked" "$TMP/outside"
if FM_HOME="$HOME_ROOT" "$CMD" --task linked --state failed --summary unsafe >/dev/null 2>&1; then
  echo 'symlink status log was accepted' >&2; exit 1
fi
printf 'ok - Worker status acceptance records bounded structured activity\n'
