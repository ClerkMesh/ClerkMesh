#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
# shellcheck source=../lib/clerk-lifecycle-lock.sh
. "$SCRIPT_DIR/../lib/clerk-lifecycle-lock.sh"
clerk_lifecycle_lock_acquire
clerk_lifecycle_lock_trap
node "$SCRIPT_DIR/../src/clerk-commit.mjs" "$@"
