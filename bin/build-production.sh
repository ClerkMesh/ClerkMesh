#!/usr/bin/env bash
# Build and validate the production assets from the repository root.
set -eu

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
ROOT=$(cd "$SCRIPT_DIR/.." && pwd -P)
cd "$ROOT"

[ "$(uname -s)" = Darwin ] || {
  printf 'error: ClerkMesh V1 production builds are supported only on macOS\n' >&2
  exit 1
}
[ "$(uname -m)" = arm64 ] || {
  printf 'error: ClerkMesh V1 production builds require Apple Silicon (arm64)\n' >&2
  exit 1
}
command -v node >/dev/null 2>&1 || { printf 'error: required dependency not found: node\n' >&2; exit 1; }
command -v git >/dev/null 2>&1 || { printf 'error: required dependency not found: git\n' >&2; exit 1; }
command -v corepack >/dev/null 2>&1 || { printf 'error: required dependency not found: corepack\n' >&2; exit 1; }

# Frozen install makes the lockfile, rather than ambient package state, authoritative.
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @clerkmesh/web-client build
corepack pnpm --filter @clerkmesh/shared check:generated
bash -n bin/clerkmesh

[ -s apps/web/client/dist/index.html ] || {
  printf 'error: production Web entrypoint was not built\n' >&2
  exit 1
}
asset_count=$(find apps/web/client/dist/assets -type f -size +0c 2>/dev/null | wc -l | tr -d ' ')
[ "$asset_count" -ge 2 ] || {
  printf 'error: production Web assets are incomplete\n' >&2
  exit 1
}

printf 'ClerkMesh production build passed (%s, %s assets)\n' "$(uname -m)" "$asset_count"
