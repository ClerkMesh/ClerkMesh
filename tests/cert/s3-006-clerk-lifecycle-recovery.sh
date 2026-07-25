#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd -P)
cd "$ROOT"

# Slice 3 boundary repetition of Clerk lifecycle authority and recovery.
# Every test uses isolated roots and real Git/process behavior.
bash tests/slice2-clerk-lifecycle-lock.test.sh
bash tests/slice2-clerk-archive-cli.test.sh
bash tests/slice2-clerk-restore-cli.test.sh
bash tests/slice2-clerk-commit-cli.test.sh
bash tests/slice2-clerk-kill-recovery.test.sh

printf '%s\n' 'ok - S3-006 Clerk lifecycle lock, archive/restore, CAS, and kill/restart recovery certification passed'
