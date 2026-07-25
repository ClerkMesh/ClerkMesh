#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd -P)
EVIDENCE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-s3-005.XXXXXX")
trap 'rm -rf "$EVIDENCE_DIR"' EXIT
PATH="$ROOT/cache/bin:$PATH" S3_005_RECOVERY_EVIDENCE_DIR="$EVIDENCE_DIR" \
  bash "$ROOT/firstmate/tests/fm-backend-herdr-workspace-per-home-e2e.test.sh"
[ -s "$EVIDENCE_DIR/result.json" ]
printf 'ok - S3-005 genuine Web/Worker exit-recovery evidence: %s\n' "$(tr -d '\n' < "$EVIDENCE_DIR/result.json")"
