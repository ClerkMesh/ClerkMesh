#!/usr/bin/env bash
# Contract coverage that local-only Worker briefs exclude remote-delivery tooling.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
HOME_ROOT=$TMP/home
mkdir -p "$HOME_ROOT/data"
printf '%s\n' '- demo [local-only] - local brief fixture' > "$HOME_ROOT/data/projects.md"

FM_HOME="$HOME_ROOT" "$ROOT/firstmate/bin/fm-brief.sh" local-brief-a1 demo >/dev/null
BRIEF=$HOME_ROOT/data/local-brief-a1/brief.md

grep -F 'This project ships **local-only**: no remote, no PR, no pipeline.' "$BRIEF" >/dev/null
grep -F 'This local-only execution must not use forge tooling.' "$BRIEF" >/dev/null
if grep -E 'GitHub|gh-axi|no-mistakes (doctor|init|axi)|/no-mistakes' "$BRIEF" >/dev/null; then
  echo 'local-only brief leaked remote delivery tooling or rules' >&2
  exit 1
fi
grep -F 'Keep your branch a clean fast-forward' "$BRIEF" >/dev/null
grep -F 'configured merge authority approves' "$BRIEF" >/dev/null

printf 'ok - local-only brief excludes remote delivery tooling and retains validation/landing contract\n'
