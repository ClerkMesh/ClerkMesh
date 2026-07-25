#!/bin/sh
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
# shellcheck source=../lib/clerk-lifecycle-lock.sh
. "$HERE/../lib/clerk-lifecycle-lock.sh"

: "${CLERKMESH_DATA:?CLERKMESH_DATA is required}"
: "${CLERKMESH_CLERKS:?CLERKMESH_CLERKS is required}"
clerk_lifecycle_lock_acquire
clerk_lifecycle_lock_trap
node "$HERE/../src/clerk-restore.mjs" "$@"
