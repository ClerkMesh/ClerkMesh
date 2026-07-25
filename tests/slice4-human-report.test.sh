#!/usr/bin/env bash
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
CMD="$ROOT/firstmate/bin/fm-human-report.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/home/data/human-task"
HOME_ROOT=$(cd "$TMP/home" && pwd -P)
printf '# Brief\n\nAcceptance: documented result.\n' > "$HOME_ROOT/data/human-task/brief.md"

out=$(printf 'The Captain relayed the completed analysis.\n' | FM_HOME="$HOME_ROOT" "$CMD" \
  --task human-task --outcome accepted --evaluation 'The documented result satisfies the acceptance criterion.')
[ "$out" = $'human-report\thuman-task\taccepted' ]
report="$HOME_ROOT/data/human-task/report.md"
grep -Fq '<!-- clerkmesh-provenance: {"actor":{"type":"captain","id":"local"}} -->' "$report"
grep -Fq 'The Captain relayed the completed analysis.' "$report"
grep -Fq -- '- Outcome: `accepted`' "$report"
grep -Fq -- '- Evaluation: The documented result satisfies the acceptance criterion.' "$report"

before=$(shasum -a 256 "$report" | awk '{print $1}')
if printf 'replacement\n' | FM_HOME="$HOME_ROOT" "$CMD" --task human-task --outcome done --evaluation valid >"$TMP/out" 2>"$TMP/err"; then
  echo 'invalid outcome unexpectedly succeeded' >&2; exit 1
fi
[ ! -s "$TMP/out" ]
[ "$before" = "$(shasum -a 256 "$report" | awk '{print $1}')" ]

ln -s report.md "$HOME_ROOT/data/human-task/unsafe.md"
mv "$report" "$HOME_ROOT/data/human-task/report.real"
ln -s report.real "$report"
if printf 'replacement\n' | FM_HOME="$HOME_ROOT" "$CMD" --task human-task --outcome rejected --evaluation refused >"$TMP/out" 2>"$TMP/err"; then
  echo 'symlinked report unexpectedly succeeded' >&2; exit 1
fi
[ ! -s "$TMP/out" ]
grep -Fq 'unsafe report' "$TMP/err"
[ "$before" = "$(shasum -a 256 "$HOME_ROOT/data/human-task/report.real" | awk '{print $1}')" ]

rm "$report"
: > "$TMP/empty"
if FM_HOME="$HOME_ROOT" "$CMD" --task human-task --outcome incomplete --evaluation 'No result was relayed.' < "$TMP/empty" >"$TMP/out" 2>"$TMP/err"; then
  echo 'empty result unexpectedly succeeded' >&2; exit 1
fi
[ ! -e "$report" ]
[ -z "$(find "$HOME_ROOT/data/human-task" -maxdepth 1 -name '.human-*' -print -quit)" ]

printf 'ok - Human Clerk report publication is atomic, provenance-bearing, and fail closed\n'
