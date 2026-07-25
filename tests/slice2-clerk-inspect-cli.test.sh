#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-inspect.XXXXXX")
TMP=$(CDPATH= cd -- "$TMP" && pwd -P)
trap 'rm -rf "$TMP"' EXIT HUP INT TERM
mkdir -p "$TMP/clerks"
make_clerk() {
  name=$1 execution=$2 description=$3
  repo="$TMP/clerks/$name"; mkdir "$repo"
  cat >"$repo/CLERK.md" <<EOF
---
name: $name
description: $description
execution: $execution
---

# Role
Role $name.

# Capabilities
Capabilities $name.

# Boundaries
Boundaries $name.

# Working Style
Style $name.

# Instructions
Instructions $name.

# Context
Context $name.
EOF
  git init -q "$repo"; git -C "$repo" add CLERK.md
  git -C "$repo" -c user.name=Test -c user.email=test@invalid commit -q -m approved
}
make_clerk escalation human 'Captain takeover only.'
make_clerk review-clerk agent 'Reviews bounded changes.'
make_clerk old-clerk agent 'Archived specialist.'
REGISTRY="$TMP/clerks.md"
cat >"$REGISTRY" <<EOF
# Clerk registry v1

| name | path | status | built-in |
|---|---|---|---|
| escalation | $TMP/clerks/escalation | active | true |
| review-clerk | $TMP/clerks/review-clerk | active | false |
| old-clerk | $TMP/clerks/old-clerk | archived | false |
EOF
OID=$(git -C "$TMP/clerks/review-clerk" rev-parse HEAD)
OUT=$(cd / && "$ROOT/packages/clerk-cli/bin/clerk-inspect.sh" --index "$REGISTRY" "$TMP/clerks")
printf '%s\n' "$OUT" | grep -F "review-clerk	agent	$OID	Reviews bounded changes." >/dev/null
! printf '%s\n' "$OUT" | grep -q old-clerk
SHORT=$("$ROOT/packages/clerk-cli/bin/clerk-inspect.sh" --shortlist "$TMP/clerks/review-clerk" "$OID")
printf '%s\n' "$SHORT" | grep -q '^# Role$'
printf '%s\n' "$SHORT" | grep -q '^# Boundaries$'
! printf '%s\n' "$SHORT" | grep -q 'Working Style'
CONTEXT=$("$ROOT/packages/clerk-cli/bin/clerk-inspect.sh" --context "$TMP/clerks/review-clerk" "$OID")
printf '%s\n' "$CONTEXT" | grep -q '^# Working Style$'
! printf '%s\n' "$CONTEXT" | grep -q '^# Role$'
printf '%s\n' broken >"$TMP/clerks/review-clerk/CLERK.md"
"$ROOT/packages/clerk-cli/bin/clerk-inspect.sh" --shortlist "$TMP/clerks/review-clerk" "$OID" >/dev/null
if "$ROOT/packages/clerk-cli/bin/clerk-inspect.sh" --context "$TMP/clerks/review-clerk" deadbeef >"$TMP/out" 2>"$TMP/err"; then exit 1; fi
[ ! -s "$TMP/out" ]; grep -q 'approved commit is missing' "$TMP/err"
echo 'ok - Clerk inspect progressively discloses approved commit content'
