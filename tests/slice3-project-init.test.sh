#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
CMD=$ROOT/firstmate/bin/fm-project-init.sh
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
HOME_DIR=$TMP/home
mkdir -p "$HOME_DIR/data" "$HOME_DIR/projects"
: > "$HOME_DIR/data/projects.md"

out=$(FM_HOME="$HOME_DIR" bash "$CMD" alpha 'Alpha local project')
case "$out" in alpha$'\t'local-only$'\t'[0-9a-f][0-9a-f]*) ;; *) echo "unexpected output: $out" >&2; exit 1 ;; esac
[ "$(git -C "$HOME_DIR/projects/alpha" branch --show-current)" = main ]
[ "$(git -C "$HOME_DIR/projects/alpha" log -1 --format=%s)" = 'Initial local project baseline' ]
[ "$(cat "$HOME_DIR/projects/alpha/README.md")" = $'# alpha\n\nLocal ClerkMesh project.' ]
[ -z "$(git -C "$HOME_DIR/projects/alpha" remote)" ]
[ -z "$(git -C "$HOME_DIR/projects/alpha" status --porcelain)" ]
grep -Fx -- '- alpha [local-only] - Alpha local project' "$HOME_DIR/data/projects.md" >/dev/null
[ "$(FM_HOME="$HOME_DIR" "$ROOT/firstmate/bin/fm-project-preflight.sh" alpha)" = 'local-only off' ]

# All preflight refusals are zero-write.
before=$(find "$HOME_DIR" -type f -exec shasum -a 256 {} + | sort)
if FM_HOME="$HOME_DIR" bash "$CMD" alpha duplicate >"$TMP/out" 2>"$TMP/err"; then exit 1; fi
[ ! -s "$TMP/out" ]
[ "$before" = "$(find "$HOME_DIR" -type f -exec shasum -a 256 {} + | sort)" ]
if FM_HOME="$HOME_DIR" bash "$CMD" '../escape' bad >"$TMP/out" 2>"$TMP/err"; then exit 1; fi
[ ! -e "$TMP/escape" ]
printf 'malformed /private/path\n' >> "$HOME_DIR/data/projects.md"
before=$(find "$HOME_DIR" -type f -exec shasum -a 256 {} + | sort)
if FM_HOME="$HOME_DIR" bash "$CMD" beta Beta >"$TMP/out" 2>"$TMP/err"; then exit 1; fi
[ ! -e "$HOME_DIR/projects/beta" ]
[ "$before" = "$(find "$HOME_DIR" -type f -exec shasum -a 256 {} + | sort)" ]

echo 'ok - Slice 3 deterministic local-only Project init is fail-closed and registry-last'
