#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-lifecycle-lock.XXXXXX")
trap 'rm -rf "$TMP"' EXIT HUP INT TERM
export CLERKMESH_STATE="$TMP/state"
LOCK_LIB="$ROOT/packages/clerk-cli/lib/clerk-lifecycle-lock.sh"

# shellcheck source=/dev/null
. "$LOCK_LIB"
clerk_lifecycle_lock_acquire
[ -d "$CLERKMESH_STATE/clerk-lifecycle.lock" ]

if CLERKMESH_STATE="$CLERKMESH_STATE" sh -c '. "$1"; clerk_lifecycle_lock_acquire' sh "$LOCK_LIB" >"$TMP/out" 2>"$TMP/err"; then
  echo "second writer acquired a live lifecycle lock" >&2
  exit 1
fi
grep -q "held by live PID $$" "$TMP/err"
clerk_lifecycle_lock_release
[ ! -e "$CLERKMESH_STATE/clerk-lifecycle.lock" ]

# A dead owner is reclaimable, while malformed ownership fails closed.
mkdir "$CLERKMESH_STATE/clerk-lifecycle.lock"
printf '999999 stale\n' >"$CLERKMESH_STATE/clerk-lifecycle.lock/owner"
clerk_lifecycle_lock_acquire
owner=$(cat "$CLERKMESH_STATE/clerk-lifecycle.lock/owner")
[ "${owner%% *}" = "$$" ]
clerk_lifecycle_lock_release

mkdir "$CLERKMESH_STATE/clerk-lifecycle.lock"
printf 'not-a-pid corrupt\n' >"$CLERKMESH_STATE/clerk-lifecycle.lock/owner"
if clerk_lifecycle_lock_acquire 2>"$TMP/malformed"; then
  echo "malformed lifecycle lock was stolen" >&2
  exit 1
fi
grep -q "invalid ownership metadata" "$TMP/malformed"
rm -rf "$CLERKMESH_STATE/clerk-lifecycle.lock"

# Release is ownership checked and cannot remove a replacement lock.
clerk_lifecycle_lock_acquire
saved_owner=$CLERK_LIFECYCLE_LOCK_OWNER
printf '%s replacement\n' "$$" >"$CLERKMESH_STATE/clerk-lifecycle.lock/owner"
CLERK_LIFECYCLE_LOCK_OWNER=$saved_owner clerk_lifecycle_lock_release
[ -d "$CLERKMESH_STATE/clerk-lifecycle.lock" ]

printf '%s\n' "ok - Slice 2 Clerk lifecycle live-PID lock is fail-closed and ownership checked"
