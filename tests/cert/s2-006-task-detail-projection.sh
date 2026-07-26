#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$ROOT"

node tests/slice2-clerk-catalog-schema.test.mjs
node tests/slice2-clerk-catalog-projection.test.mjs
node tests/slice2-clerk-catalog-http.test.mjs
node tests/slice2-fm-task-graph-schema.test.mjs
node tests/slice2-fm-task-graph-projection.test.mjs
node tests/slice2-fm-task-graph-http.test.mjs
node tests/slice2-task-detail-schema.test.mjs
node tests/slice2-task-detail-composition.test.mjs

# Firstmate remains Clerk-agnostic: no Clerk assignment/ownership field may enter
# its production control plane. The only Clerk-aware composition is Web-owned.
if rg -i 'execution[_-]?clerk|clerk[_-]?(owner|assignment)' firstmate/bin firstmate/.pi/extensions >/dev/null; then
  echo "Firstmate production control plane contains a Clerk ownership field" >&2
  exit 1
fi
if [ -e firstmate/bin/fm-human-report.sh ] || [ ! -x packages/clerk-cli/bin/clerk-human-report.sh ]; then
  echo "Human Clerk report semantics are not confined to the ClerkMesh control plane" >&2
  exit 1
fi

printf '%s\n' 'ok - S2-006 path-free Clerk catalog and transient Task-detail projection passed'
