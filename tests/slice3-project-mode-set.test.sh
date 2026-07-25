#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
HOME_ROOT=$TMP/home
mkdir -p "$HOME_ROOT/data" "$HOME_ROOT/projects/demo" "$TMP/bin"
printf '%s\n' '- demo [local-only +yolo] - Demo project (added 2026-01-01)' > "$HOME_ROOT/data/projects.md"
git -C "$HOME_ROOT/projects/demo" init -q -b main
git -C "$HOME_ROOT/projects/demo" config user.name Test
git -C "$HOME_ROOT/projects/demo" config user.email test@example.invalid
printf x > "$HOME_ROOT/projects/demo/file"; git -C "$HOME_ROOT/projects/demo" add file; git -C "$HOME_ROOT/projects/demo" commit -qm base
CMD="$ROOT/firstmate/bin/fm-project-mode-set.sh"
export FM_HOME="$HOME_ROOT" FM_ROOT_OVERRIDE="$ROOT/firstmate"

# Missing remote/tool readiness must leave the authority byte-identical.
before=$(shasum -a 256 "$HOME_ROOT/data/projects.md")
if "$CMD" demo direct-PR >"$TMP/out" 2>"$TMP/err"; then echo 'expected remote refusal' >&2; exit 1; fi
[ ! -s "$TMP/out" ]
[ "$before" = "$(shasum -a 256 "$HOME_ROOT/data/projects.md")" ]
grep -q 'registry unchanged' "$TMP/err"

# A ready remote mode publishes atomically while preserving yolo and prose.
git init -q --bare "$TMP/origin.git"
git -C "$HOME_ROOT/projects/demo" remote add origin git@github.com:example/demo.git
cat > "$TMP/bin/gh" <<'SH'
#!/bin/sh
[ "$1 $2" = 'auth status' ]
SH
cat > "$TMP/bin/gh-axi" <<'SH'
#!/bin/sh
exit 0
SH
chmod +x "$TMP/bin/gh" "$TMP/bin/gh-axi"
PATH="$TMP/bin:$PATH" "$CMD" demo direct-PR > "$TMP/out"
grep -qx $'demo\tdirect-PR\ton' "$TMP/out"
grep -Fqx -- '- demo [direct-PR +yolo] - Demo project (added 2026-01-01)' "$HOME_ROOT/data/projects.md"

# Existing Task dispatch metadata remains fixed to its spawn-time contract.
mkdir -p "$HOME_ROOT/data/task-old"
printf '%s\n' 'mode=direct-PR' > "$HOME_ROOT/data/task-old/.meta"
PATH="$TMP/bin:$PATH" "$CMD" demo local-only >/dev/null
grep -qx 'mode=direct-PR' "$HOME_ROOT/data/task-old/.meta"
grep -Fqx -- '- demo [local-only +yolo] - Demo project (added 2026-01-01)' "$HOME_ROOT/data/projects.md"

echo 'ok - project mode changes require target preflight and affect only future dispatches'
