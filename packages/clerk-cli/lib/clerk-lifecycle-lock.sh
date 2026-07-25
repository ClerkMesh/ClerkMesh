#!/bin/sh
# Shared short-held authority for Clerk lifecycle mutations. Source this file,
# call clerk_lifecycle_lock_acquire, and install clerk_lifecycle_lock_trap.

clerk_lifecycle_lock_fail() {
  printf '%s\n' "clerk lifecycle: $*" >&2
  return 1
}

clerk_lifecycle_lock_acquire() {
  : "${CLERKMESH_STATE:?CLERKMESH_STATE is required}"
  CLERK_LIFECYCLE_LOCK="$CLERKMESH_STATE/clerk-lifecycle.lock"
  CLERK_LIFECYCLE_LOCK_OWNER="$$.$(date +%s).${RANDOM:-0}"
  mkdir -p "$CLERKMESH_STATE" || return 1

  while ! mkdir "$CLERK_LIFECYCLE_LOCK" 2>/dev/null; do
    owner_file="$CLERK_LIFECYCLE_LOCK/owner"
    owner=$(cat "$owner_file" 2>/dev/null) || {
      clerk_lifecycle_lock_fail "lock exists without readable ownership metadata"
      return 1
    }
    owner_pid=${owner%% *}
    case "$owner_pid" in *[!0-9]*|'')
      clerk_lifecycle_lock_fail "lock has invalid ownership metadata"
      return 1
    esac
    if kill -0 "$owner_pid" 2>/dev/null; then
      clerk_lifecycle_lock_fail "lock is held by live PID $owner_pid"
      return 1
    fi

    # Rename the observed stale lock before removal. A concurrent contender can
    # only win by renaming first; no contender removes a newly acquired lock.
    stale="$CLERK_LIFECYCLE_LOCK.stale.$$"
    if mv "$CLERK_LIFECYCLE_LOCK" "$stale" 2>/dev/null; then
      rm -rf "$stale" || return 1
    fi
  done

  if ! (umask 077 && printf '%s %s\n' "$$" "$CLERK_LIFECYCLE_LOCK_OWNER" >"$CLERK_LIFECYCLE_LOCK/owner"); then
    rmdir "$CLERK_LIFECYCLE_LOCK" 2>/dev/null || true
    return 1
  fi
  export CLERK_LIFECYCLE_LOCK CLERK_LIFECYCLE_LOCK_OWNER
}

clerk_lifecycle_lock_release() {
  [ -n "${CLERK_LIFECYCLE_LOCK:-}" ] || return 0
  owner=$(cat "$CLERK_LIFECYCLE_LOCK/owner" 2>/dev/null) || return 0
  [ "$owner" = "$$ $CLERK_LIFECYCLE_LOCK_OWNER" ] || return 0
  rm -f "$CLERK_LIFECYCLE_LOCK/owner" && rmdir "$CLERK_LIFECYCLE_LOCK"
  unset CLERK_LIFECYCLE_LOCK CLERK_LIFECYCLE_LOCK_OWNER
}

clerk_lifecycle_lock_trap() {
  trap 'clerk_lifecycle_lock_release' EXIT HUP INT TERM
}
