#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd -P)
cd "$ROOT"

# Stage-boundary certification for the four Firstmate-owned Web projections.
# These tests invoke the production projection commands and validate their
# output against the tracked v1 schemas, including fail-closed states.
node tests/slice3-fm-project-catalog-projection.test.mjs
node tests/slice2-fm-task-graph-projection.test.mjs
node tests/slice3-fm-herdr-agents-projection.test.mjs
node tests/slice3-fm-task-activity-projection.test.mjs

# Prove the activity cursor is backed by the production durable append
# boundary rather than only by a hand-authored projection fixture.
node tests/slice3-fm-task-activity-append.test.mjs

printf '%s\n' 'ok - S3-003 four Firstmate projections passed schema, freshness, unknown/error, and cursor certification'
