#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-archive.XXXXXX")
TMP=$(CDPATH= cd -- "$TMP" && pwd -P)
trap 'rm -rf "$TMP"' EXIT HUP INT TERM
export CLERKMESH_DATA="$TMP/data" CLERKMESH_STATE="$TMP/state" CLERKMESH_CLERKS="$TMP/clerks"
mkdir -p "$CLERKMESH_DATA" "$CLERKMESH_STATE" "$CLERKMESH_CLERKS/escalation" "$CLERKMESH_CLERKS/review-clerk"
cat >"$CLERKMESH_DATA/clerks.md" <<EOF
# Clerk registry v1

| name | path | status | built-in |
|---|---|---|---|
| escalation | $CLERKMESH_CLERKS/escalation | active | true |
| review-clerk | $CLERKMESH_CLERKS/review-clerk | active | false |
EOF
chmod +x "$ROOT/packages/clerk-cli/bin/clerk-archive.sh"

OUT=$(cd / && "$ROOT/packages/clerk-cli/bin/clerk-archive.sh" review-clerk)
[ "$OUT" = "review-clerk	archived" ]
grep -Fq "| review-clerk | $CLERKMESH_CLERKS/review-clerk | archived | false |" "$CLERKMESH_DATA/clerks.md"
[ ! -e "$CLERKMESH_STATE/clerk-lifecycle.lock" ]

# Repeating the deterministic mutation is idempotent and does not rewrite bytes.
cp "$CLERKMESH_DATA/clerks.md" "$TMP/before"
OUT=$("$ROOT/packages/clerk-cli/bin/clerk-archive.sh" review-clerk)
[ "$OUT" = "review-clerk	archived" ]
cmp "$TMP/before" "$CLERKMESH_DATA/clerks.md"

if "$ROOT/packages/clerk-cli/bin/clerk-archive.sh" escalation >"$TMP/out" 2>"$TMP/err"; then
  echo "Escalation Clerk unexpectedly archived" >&2; exit 1
fi
[ ! -s "$TMP/out" ]
grep -q 'Escalation Clerk cannot be archived' "$TMP/err"
grep -Fq '| escalation | ' "$CLERKMESH_DATA/clerks.md"

mkdir "$CLERKMESH_STATE/clerk-lifecycle.lock"
printf '%s owner\n' "$$" >"$CLERKMESH_STATE/clerk-lifecycle.lock/owner"
if "$ROOT/packages/clerk-cli/bin/clerk-archive.sh" review-clerk >"$TMP/out" 2>"$TMP/err"; then
  echo "live lifecycle lock unexpectedly bypassed" >&2; exit 1
fi
[ ! -s "$TMP/out" ]
grep -q "lock is held by live PID $$" "$TMP/err"

printf '%s\n' 'ok - Clerk archive is locked, atomic, idempotent, and preserves Escalation'
