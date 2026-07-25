#!/usr/bin/env bash
# Atomically record a Captain-relayed Human Clerk result in Firstmate's Task report.
# Usage: fm-human-report.sh --task <id> --outcome accepted|rejected|incomplete --evaluation <text> < result.md
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
FM_HOME=${FM_HOME:-$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd -P)}
DATA=${FM_DATA_OVERRIDE:-$FM_HOME/data}

usage() {
  echo "usage: fm-human-report.sh --task <id> --outcome accepted|rejected|incomplete --evaluation <text>" >&2
  exit 2
}

TASK= OUTCOME= EVALUATION=
while [ "$#" -gt 0 ]; do
  [ "$#" -ge 2 ] || usage
  case "$1" in
    --task) TASK=$2 ;;
    --outcome) OUTCOME=$2 ;;
    --evaluation) EVALUATION=$2 ;;
    *) usage ;;
  esac
  shift 2
done

[[ "$TASK" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]] || usage
case "$OUTCOME" in accepted|rejected|incomplete) ;; *) usage ;; esac
[ -n "$EVALUATION" ] && [ "${#EVALUATION}" -le 900 ] \
  && [[ "$EVALUATION" != *$'\n'* ]] && [[ "$EVALUATION" != *$'\r'* ]] || usage

canonical_data=$(cd -- "$DATA" 2>/dev/null && pwd -P) \
  || { echo "fm-human-report: data unavailable" >&2; exit 1; }
[ "$canonical_data" = "$DATA" ] \
  || { echo "fm-human-report: unsafe data" >&2; exit 1; }
task_dir="$DATA/$TASK"
[ -d "$task_dir" ] && [ ! -L "$task_dir" ] \
  && [ "$(cd -- "$task_dir" && pwd -P)" = "$task_dir" ] \
  || { echo "fm-human-report: task unavailable" >&2; exit 1; }
brief="$task_dir/brief.md"
[ -f "$brief" ] && [ ! -L "$brief" ] \
  || { echo "fm-human-report: Task brief unavailable" >&2; exit 1; }
context_check="$SCRIPT_DIR/../../packages/clerk-cli/src/human-execution-context-check.mjs"
[ -f "$context_check" ] \
  && node "$context_check" "$brief" "$TASK" \
  || { echo "fm-human-report: Task is not bound to a valid Human Clerk execution" >&2; exit 1; }
report="$task_dir/report.md"
[ ! -e "$report" ] || { [ -f "$report" ] && [ ! -L "$report" ]; } \
  || { echo "fm-human-report: unsafe report" >&2; exit 1; }

body=$(mktemp "$task_dir/.human-result.XXXXXX") \
out=$(mktemp "$task_dir/.human-report.XXXXXX")
cleanup() { rm -f -- "$body" "$out"; }
trap cleanup EXIT HUP INT TERM
cat > "$body"
size=$(wc -c < "$body" | tr -d ' ')
[ "$size" -gt 0 ] && [ "$size" -le 262144 ] \
  || { echo "fm-human-report: result must contain 1..262144 bytes" >&2; exit 1; }
node -e '
  const fs = require("node:fs");
  const bytes = fs.readFileSync(process.argv[1]);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (text.includes("\\0")) process.exit(1);
' "$body" 2>/dev/null || { echo "fm-human-report: result must be UTF-8 Markdown" >&2; exit 1; }

{
  printf '# Human Clerk Result\n\n'
  printf '<!-- clerkmesh-provenance: {"actor":{"type":"captain","id":"local"}} -->\n\n'
  printf '## Result\n\n'
  cat "$body"
  tail_byte=$(tail -c 1 "$body" || true)
  [ -z "$tail_byte" ] || printf '\n'
  printf '\n## Acceptance Evaluation\n\n- Outcome: `%s`\n- Evaluation: %s\n' "$OUTCOME" "$EVALUATION"
} > "$out"
chmod 0644 "$out"
if [ "$OUTCOME" = accepted ]; then
  source_capture="$SCRIPT_DIR/../../packages/learning-core/src/accepted-human-source-cli.mjs"
  [ -f "$source_capture" ] && node "$source_capture" "$out" "$TASK" >/dev/null \
    || { echo "fm-human-report: accepted result could not create Learning Source" >&2; exit 1; }
fi
mv -f -- "$out" "$report"
trap - EXIT HUP INT TERM
rm -f -- "$body"
printf 'human-report\t%s\t%s\n' "$TASK" "$OUTCOME"
