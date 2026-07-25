#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-create.XXXXXX")
TMP=$(CDPATH= cd -- "$TMP" && pwd -P)
trap 'rm -rf "$TMP"' EXIT HUP INT TERM
export CLERKMESH_DATA="$TMP/data" CLERKMESH_STATE="$TMP/state" CLERKMESH_CLERKS="$TMP/clerks"
mkdir -p "$CLERKMESH_DATA" "$CLERKMESH_STATE" "$CLERKMESH_CLERKS/escalation" "$TMP/source"
cat >"$CLERKMESH_DATA/clerks.md" <<EOF
# Clerk registry v1

| name | path | status | built-in |
|---|---|---|---|
| escalation | $CLERKMESH_CLERKS/escalation | active | true |
EOF
cat >"$TMP/source/CLERK.md" <<'EOF'
---
name: review-clerk
description: Reviews changes carefully.
execution: agent
---
# Role
Review changes.
# Capabilities
Code review.
# Boundaries
Do not land.
# Working Style
Be precise.
# Instructions
Inspect evidence.
# Context
Use the brief.
EOF
chmod +x "$ROOT/packages/clerk-cli/bin/clerk-create.sh"
OUT=$(cd / && "$ROOT/packages/clerk-cli/bin/clerk-create.sh" review-clerk "$TMP/source")
printf '%s\n' "$OUT" | grep -Eq '^review-clerk[[:space:]][0-9a-f]{40}[[:space:]]active$'
[ ! -e "$TMP/source/.git" ]
[ -d "$CLERKMESH_CLERKS/review-clerk/.git" ]
[ "$(git -C "$CLERKMESH_CLERKS/review-clerk" rev-list --count HEAD)" = 1 ]
[ -z "$(git -C "$CLERKMESH_CLERKS/review-clerk" remote)" ]
grep -Fq "| review-clerk | $CLERKMESH_CLERKS/review-clerk | active | false |" "$CLERKMESH_DATA/clerks.md"
[ ! -e "$CLERKMESH_STATE/clerk-lifecycle.lock" ]

# Restart recovery completes a repository publish interrupted before registry publication.
grep -v '^| review-clerk |' "$CLERKMESH_DATA/clerks.md" >"$TMP/interrupted-registry"
mv "$TMP/interrupted-registry" "$CLERKMESH_DATA/clerks.md"
node --input-type=module - "$ROOT" "$CLERKMESH_STATE" "$CLERKMESH_CLERKS/review-clerk" <<'EOF'
const { createJournalPath, writeCreateJournal } = await import(`file://${process.argv[2]}/packages/clerk-cli/src/clerk-lifecycle-journal.mjs`);
await writeCreateJournal({ journalPath: createJournalPath(process.argv[3]), name: "review-clerk", destination: process.argv[4] });
EOF
OUT=$("$ROOT/packages/clerk-cli/bin/clerk-create.sh" review-clerk "$TMP/source")
printf '%s\n' "$OUT" | grep -Eq '^review-clerk[[:space:]][0-9a-f]{40}[[:space:]]active$'
grep -Fq "| review-clerk | $CLERKMESH_CLERKS/review-clerk | active | false |" "$CLERKMESH_DATA/clerks.md"
[ ! -e "$CLERKMESH_STATE/clerk-lifecycle-journal.v1.json" ]

# A failed candidate leaves neither a repository nor a registry row.
mkdir "$TMP/bad"; printf 'invalid\n' >"$TMP/bad/CLERK.md"
cp "$CLERKMESH_DATA/clerks.md" "$TMP/before"
if "$ROOT/packages/clerk-cli/bin/clerk-create.sh" bad-clerk "$TMP/bad" >"$TMP/out" 2>"$TMP/err"; then
  echo 'invalid Clerk unexpectedly created' >&2; exit 1
fi
[ ! -s "$TMP/out" ]; [ ! -e "$CLERKMESH_CLERKS/bad-clerk" ]; cmp "$TMP/before" "$CLERKMESH_DATA/clerks.md"
! find "$CLERKMESH_CLERKS" -maxdepth 1 -name '.bad-clerk.create.*' | grep -q .

# Unknown journal state fails closed and remains available for diagnosis.
printf '%s\n' '{"version":99}' >"$CLERKMESH_STATE/clerk-lifecycle-journal.v1.json"
if "$ROOT/packages/clerk-cli/bin/clerk-create.sh" another-clerk "$TMP/source" >"$TMP/out" 2>"$TMP/err"; then
  echo 'unsupported journal unexpectedly ignored' >&2; exit 1
fi
[ ! -s "$TMP/out" ]; grep -q 'journal has unsupported content' "$TMP/err"
[ -f "$CLERKMESH_STATE/clerk-lifecycle-journal.v1.json" ]
rm "$CLERKMESH_STATE/clerk-lifecycle-journal.v1.json"

# Names are never reusable, even while archived.
if "$ROOT/packages/clerk-cli/bin/clerk-create.sh" review-clerk "$TMP/source" >"$TMP/out" 2>"$TMP/err"; then
  echo 'duplicate Clerk unexpectedly created' >&2; exit 1
fi
[ ! -s "$TMP/out" ]; grep -q 'already used' "$TMP/err"
printf '%s\n' 'ok - Clerk create stages, validates, commits, publishes, and registers atomically'
