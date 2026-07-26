#!/usr/bin/env bash
# Create a relocatable ClerkMesh V1 source distribution with built Web assets.
set -eu

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
ROOT=$(cd "$SCRIPT_DIR/.." && pwd -P)
cd "$ROOT"

bash bin/build-production.sh

OUTPUT_DIR=${CLERKMESH_DIST_DIR:-"$ROOT/dist"}
case "$OUTPUT_DIR" in
  /*) ;;
  *) OUTPUT_DIR="$ROOT/$OUTPUT_DIR" ;;
esac
mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR=$(cd "$OUTPUT_DIR" && pwd -P)

stage=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-package.XXXXXX")
cleanup() { rm -rf "$stage"; }
trap cleanup EXIT INT TERM
bundle="$stage/clerkmesh-v1"
mkdir -p "$bundle"

# The Git index defines product source membership, while bytes come from the
# current tree so this check remains useful before the release commit exists.
git ls-files -z | while IFS= read -r -d '' path; do
  { [ -f "$path" ] || [ -L "$path" ]; } || { printf 'error: tracked product file is unavailable: %s\n' "$path" >&2; exit 1; }
  mkdir -p "$bundle/$(dirname "$path")"
  cp -pP "$path" "$bundle/$path"
done

# Vite output is intentionally ignored source output, but required at runtime.
mkdir -p "$bundle/apps/web/client"
cp -R apps/web/client/dist "$bundle/apps/web/client/dist"

artifact="$OUTPUT_DIR/clerkmesh-v1-macos-arm64.tar.gz"
rm -f "$artifact" "$artifact.sha256"
COPYFILE_DISABLE=1 tar -czf "$artifact" -C "$stage" clerkmesh-v1
shasum -a 256 "$artifact" > "$artifact.sha256"

# Refuse accidental runtime state, dependency trees, or missing launch assets.
tar -tzf "$artifact" | grep -qx 'clerkmesh-v1/bin/clerkmesh'
tar -tzf "$artifact" | grep -qx 'clerkmesh-v1/apps/web/client/dist/index.html'
if tar -tzf "$artifact" | grep -Eq '(^|/)(node_modules|\.clerkmesh|\.firstmate)(/|$)'; then
  printf 'error: production artifact contains runtime or dependency state\n' >&2
  exit 1
fi

printf 'ClerkMesh production artifact: %s\n' "$artifact"
printf 'SHA-256: %s\n' "$(awk '{print $1}' "$artifact.sha256")"
