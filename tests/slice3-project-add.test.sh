#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
HOME_ROOT=$TMP/home; mkdir -p "$HOME_ROOT/data" "$HOME_ROOT/projects" "$TMP/bin"
: > "$HOME_ROOT/data/projects.md"
git init -q --bare "$TMP/source.git"
git clone -q "$TMP/source.git" "$TMP/seed"; git -C "$TMP/seed" config user.name Test; git -C "$TMP/seed" config user.email test@example.invalid
printf base > "$TMP/seed/file"; git -C "$TMP/seed" add file; git -C "$TMP/seed" commit -qm base; git -C "$TMP/seed" push -q origin HEAD:main
git -C "$TMP/source.git" symbolic-ref HEAD refs/heads/main
CMD=$ROOT/firstmate/bin/fm-project-add.sh
export FM_HOME=$HOME_ROOT FM_ROOT_OVERRIDE=$ROOT/firstmate

# Remote readiness refusal removes only the newly cloned artifact and preserves authority.
before=$(shasum -a 256 "$HOME_ROOT/data/projects.md")
if "$CMD" "$TMP/source.git" refused Refused direct-PR >"$TMP/out" 2>"$TMP/err"; then echo expected refusal >&2; exit 1; fi
[ ! -e "$HOME_ROOT/projects/refused" ]; [ "$before" = "$(shasum -a 256 "$HOME_ROOT/data/projects.md")" ]; [ ! -s "$TMP/out" ]
grep -q 'registry unchanged' "$TMP/err"

# Local-only addition needs no forge tools and publishes only after real Git preflight.
"$CMD" "$TMP/source.git" local 'Local import' local-only >"$TMP/out"
grep -qx $'local\tlocal-only\toff' "$TMP/out"
grep -Fqx -- '- local [local-only] - Local import' "$HOME_ROOT/data/projects.md"
git -C "$HOME_ROOT/projects/local" rev-parse --verify HEAD >/dev/null

# A clone-only transport shim avoids network access while retaining the approved GitHub origin.
REAL_GIT=$(command -v git); export REAL_GIT SOURCE_REPO="$TMP/source.git"
cat > "$TMP/bin/git" <<'SH'
#!/bin/sh
if [ "$1" = clone ] && [ "$2" = -- ] && [ "$3" = https://github.com/example/source.git ]; then
  "$REAL_GIT" clone -- "$SOURCE_REPO" "$4" || exit
  exec "$REAL_GIT" -C "$4" remote set-url origin "$3"
fi
exec "$REAL_GIT" "$@"
SH
cat > "$TMP/bin/gh" <<'SH'
#!/bin/sh
[ "$1 $2" = 'auth status' ]
SH
cat > "$TMP/bin/gh-axi" <<'SH'
#!/bin/sh
exit 0
SH
chmod +x "$TMP/bin/git" "$TMP/bin/gh" "$TMP/bin/gh-axi"
PATH="$TMP/bin:$PATH" "$CMD" https://github.com/example/source.git remote 'Remote import' direct-PR on >"$TMP/out"
grep -qx $'remote\tdirect-PR\ton' "$TMP/out"
grep -Fqx -- '- remote [direct-PR +yolo] - Remote import' "$HOME_ROOT/data/projects.md"
[ "$(git -C "$HOME_ROOT/projects/remote" remote get-url origin)" = https://github.com/example/source.git ]

echo 'ok - project add clones safely and publishes only after mode-specific preflight'
