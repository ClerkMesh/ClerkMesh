#!/usr/bin/env bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
HOME_ROOT=$(cd "$TMP" && pwd -P)
mkdir -p "$HOME_ROOT/data/task-1"
CMD="$ROOT/firstmate/bin/fm-task-validation.sh"

out=$(FM_HOME="$HOME_ROOT" "$CMD" --task task-1 --outcome passed --summary "project checks passed")
[ "$out" = $'validation\ttask-1\tpassed' ] || { echo 'validation result output was not compact' >&2; exit 1; }
FM_HOME="$HOME_ROOT" "$CMD" --task task-1 --outcome failed --summary "unit suite failed" >/dev/null
node -e '
const fs=require("fs"); const events=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse);
if(events.length!==2 || events[0].cursor!==1 || events[1].cursor!==2) process.exit(1);
if(events[0].type!=="validation-recorded" || events[0].summary!=="Validation passed: project checks passed") process.exit(1);
if(events[1].type!=="validation-recorded" || events[1].summary!=="Validation failed: unit suite failed") process.exit(1);
if(events.some(event=>event.occurredAt!==null || Number.isNaN(Date.parse(event.observedAt)))) process.exit(1);
' "$HOME_ROOT/data/task-1/activity.jsonl" || { echo 'validation activity was malformed' >&2; exit 1; }

before=$(wc -l < "$HOME_ROOT/data/task-1/activity.jsonl" | tr -d ' ')
for args in \
  '--task task-1 --outcome unknown --summary nope' \
  '--task missing --outcome passed --summary nope'; do
  # Intentional word splitting drives argv cases.
  if FM_HOME="$HOME_ROOT" "$CMD" $args >/dev/null 2>&1; then
    echo 'invalid validation record was accepted' >&2; exit 1
  fi
done
[ "$(wc -l < "$HOME_ROOT/data/task-1/activity.jsonl" | tr -d ' ')" = "$before" ] || { echo 'refusal emitted activity' >&2; exit 1; }

ln -s "$TMP/outside" "$HOME_ROOT/data/linked"
mkdir -p "$TMP/outside"
if FM_HOME="$HOME_ROOT" "$CMD" --task linked --outcome passed --summary unsafe >/dev/null 2>&1; then
  echo 'symlinked Task storage was accepted' >&2; exit 1
fi
printf 'ok - accepted Task validation results record bounded structured activity\n'
