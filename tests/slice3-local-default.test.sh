#!/usr/bin/env bash
# PROJ-002: an origin must never imply remote-delivery authorization.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
HOME_DIR=$TMP/home
mkdir -p "$HOME_DIR/data" "$HOME_DIR/projects/legacy"
printf '%s\n' '- legacy - Untagged local project' > "$HOME_DIR/data/projects.md"
git -C "$HOME_DIR/projects/legacy" init -q -b main
git -C "$HOME_DIR/projects/legacy" config user.name Test
git -C "$HOME_DIR/projects/legacy" config user.email test@example.invalid
printf 'baseline\n' > "$HOME_DIR/projects/legacy/README.md"
git -C "$HOME_DIR/projects/legacy" add README.md
git -C "$HOME_DIR/projects/legacy" commit -qm baseline
git -C "$HOME_DIR/projects/legacy" remote add origin git@github.com:example/legacy.git

mode=$(FM_HOME="$HOME_DIR" "$ROOT/firstmate/bin/fm-project-mode.sh" legacy)
[ "$mode" = 'local-only off' ] || { echo "untagged Project defaulted to $mode" >&2; exit 1; }
preflight=$(FM_HOME="$HOME_DIR" "$ROOT/firstmate/bin/fm-project-preflight.sh" legacy)
[ "$preflight" = 'local-only off' ] || { echo "preflight changed safe default: $preflight" >&2; exit 1; }

catalog=$(FM_HOME="$HOME_DIR" node "$ROOT/firstmate/bin/fm-project-catalog.mjs")
node -e '
const value=JSON.parse(process.argv[1]);
const project=value.projects.find(p=>p.id==="legacy");
if (!project || project.delivery.mode!=="local-only" || project.delivery.yolo!==false)
  throw new Error("catalog did not preserve local-only default");
' "$catalog"

printf 'ok - untagged Projects default local-only even when origin exists\n'
