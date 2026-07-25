#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
FM_HOME=${FM_HOME:-$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd -P)}
STATE=${FM_STATE_OVERRIDE:-$FM_HOME/state}
DATA=${FM_DATA_OVERRIDE:-$FM_HOME/data}

usage() {
  echo "usage: fm-task-status.sh --task <id> --state <state> --summary <text>" >&2
  exit 2
}

TASK="" STATUS="" SUMMARY=""
while [ "$#" -gt 0 ]; do
  [ "$#" -ge 2 ] || usage
  case "$1" in
    --task) TASK=$2 ;;
    --state) STATUS=$2 ;;
    --summary) SUMMARY=$2 ;;
    *) usage ;;
  esac
  shift 2
done

[[ "$TASK" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]] || usage
# Keep the configured pause vocabulary aligned with Firstmate's status classifier.
# shellcheck source=firstmate/bin/fm-classify-lib.sh
. "$SCRIPT_DIR/fm-classify-lib.sh"
PAUSED_VERB=${FM_CLASSIFY_PAUSED_VERB:-$FM_CLASSIFY_PAUSED_VERB_DEFAULT}
case "$STATUS" in working|needs-decision|blocked|done|failed|resolved|"$PAUSED_VERB") ;; *) usage ;; esac
[ -n "$SUMMARY" ] && [ "${#SUMMARY}" -le 900 ] && [[ "$SUMMARY" != *$'\n'* ]] && [[ "$SUMMARY" != *$'\r'* ]] || usage

canonical_state=$(cd -- "$STATE" 2>/dev/null && pwd -P) || { echo "fm-task-status: state unavailable" >&2; exit 1; }
[ "$canonical_state" = "$STATE" ] || { echo "fm-task-status: unsafe state" >&2; exit 1; }
canonical_data=$(cd -- "$DATA" 2>/dev/null && pwd -P) || { echo "fm-task-status: data unavailable" >&2; exit 1; }
[ "$canonical_data" = "$DATA" ] || { echo "fm-task-status: unsafe data" >&2; exit 1; }
task_dir="$DATA/$TASK"
[ -d "$task_dir" ] && [ ! -L "$task_dir" ] && [ "$(cd -- "$task_dir" && pwd -P)" = "$task_dir" ] \
  || { echo "fm-task-status: task unavailable" >&2; exit 1; }
status_file="$STATE/$TASK.status"
[ ! -L "$status_file" ] || { echo "fm-task-status: unsafe status log" >&2; exit 1; }

printf '%s: %s\n' "$STATUS" "$SUMMARY" >> "$status_file" 
if ! FM_HOME="$FM_HOME" FM_DATA_OVERRIDE="$DATA" "$SCRIPT_DIR/fm-task-activity-append.sh" \
  --task "$TASK" --type worker-status-observed --summary "Worker reported $STATUS: $SUMMARY" >/dev/null; then
  echo "fm-task-status: status accepted but activity recording failed" >&2
  exit 1
fi
