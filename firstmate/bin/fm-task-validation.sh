#!/usr/bin/env bash
# Record a bounded validation result accepted by Firstmate for an existing Task.
# Usage: fm-task-validation.sh --task <id> --outcome passed|failed --summary <text>
set -u

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
FM_ROOT="${FM_ROOT_OVERRIDE:-$(cd "$SCRIPT_DIR/.." && pwd -P)}"
FM_HOME="${FM_HOME:-${FM_ROOT_OVERRIDE:-$FM_ROOT}}"
DATA="${FM_DATA_OVERRIDE:-$FM_HOME/data}"

TASK=
OUTCOME=
SUMMARY=
while [ "$#" -gt 0 ]; do
  [ "$#" -ge 2 ] || { echo "error: invalid validation record" >&2; exit 2; }
  case "$1" in
    --task) TASK=$2 ;;
    --outcome) OUTCOME=$2 ;;
    --summary) SUMMARY=$2 ;;
    *) echo "error: invalid validation record" >&2; exit 2 ;;
  esac
  shift 2
done

case "$OUTCOME" in passed|failed) ;; *) echo "error: invalid validation outcome" >&2; exit 2 ;; esac
[ -n "$TASK" ] && [ -n "$SUMMARY" ] || { echo "error: incomplete validation record" >&2; exit 2; }

if ! FM_HOME="$FM_HOME" FM_DATA_OVERRIDE="$DATA" "$SCRIPT_DIR/fm-task-activity-append.sh" \
  --task "$TASK" --type validation-recorded --summary "Validation $OUTCOME: $SUMMARY" >/dev/null; then
  echo "error: validation activity could not be recorded" >&2
  exit 1
fi
printf 'validation\t%s\t%s\n' "$TASK" "$OUTCOME"
