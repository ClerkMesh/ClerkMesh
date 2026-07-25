#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-register.XXXXXX")
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
name: imported-clerk
description: Imports approved knowledge.
execution: agent
---
# Role
Import knowledge.
# Capabilities
Inspect history.
# Boundaries
Do not publish.
# Working Style
Be precise.
# Instructions
Use approved facts.
# Context
Use the brief.
EOF
git -C "$TMP/source" init -q -b main
git -C "$TMP/source" config user.name Test
git -C "$TMP/source" config user.email test@example.invalid
git -C "$TMP/source" add CLERK.md
git -C "$TMP/source" commit -qm initial
printf '\nApproved history.\n' >>"$TMP/source/CLERK.md"
git -C "$TMP/source" commit -qam second
APPROVED=$(git -C "$TMP/source" rev-parse HEAD)
git -C "$TMP/source" remote add upstream https://example.invalid/private.git
printf 'dirty secret\n' >>"$TMP/source/CLERK.md"
printf 'untracked secret\n' >"$TMP/source/secret.txt"
SOURCE_STATUS=$(git -C "$TMP/source" status --porcelain)

chmod +x "$ROOT/packages/clerk-cli/bin/clerk-register.sh"
OUT=$(cd / && "$ROOT/packages/clerk-cli/bin/clerk-register.sh" imported-clerk "$TMP/source")
[ "$OUT" = "imported-clerk	$APPROVED	active" ]
DEST="$CLERKMESH_CLERKS/imported-clerk"
[ "$(git -C "$DEST" rev-list --count HEAD)" = 2 ]
[ "$(git -C "$DEST" rev-parse HEAD)" = "$APPROVED" ]
[ -z "$(git -C "$DEST" remote)" ]
! grep -q 'dirty secret' "$DEST/CLERK.md"
[ ! -e "$DEST/secret.txt" ]
[ "$(git -C "$TMP/source" status --porcelain)" = "$SOURCE_STATUS" ]
[ "$(git -C "$TMP/source" remote get-url upstream)" = 'https://example.invalid/private.git' ]
grep -Fq "| imported-clerk | $DEST | active | false |" "$CLERKMESH_DATA/clerks.md"
[ ! -e "$CLERKMESH_STATE/clerk-lifecycle.lock" ]
[ ! -e "$CLERKMESH_STATE/clerk-lifecycle-journal.v1.json" ]

# Recover the crash window after repository publication but before registry publication.
git clone -q --no-hardlinks --no-local "$TMP/source" "$TMP/recovery-source"
git -C "$TMP/recovery-source" remote remove origin
perl -0pi -e 's/imported-clerk/recovered-clerk/g' "$TMP/recovery-source/CLERK.md"
git -C "$TMP/recovery-source" config user.name Test
git -C "$TMP/recovery-source" config user.email test@example.invalid
git -C "$TMP/recovery-source" commit -qam 'rename recovered Clerk'
RECOVERED=$(git -C "$TMP/recovery-source" rev-parse HEAD)
git clone -q --no-hardlinks --no-local "$TMP/recovery-source" "$CLERKMESH_CLERKS/recovered-clerk"
git -C "$CLERKMESH_CLERKS/recovered-clerk" remote remove origin
node --input-type=module - "$ROOT" "$CLERKMESH_STATE" "$CLERKMESH_CLERKS/recovered-clerk" <<'NODE'
const { createJournalPath, writeRegisterJournal } = await import(`file://${process.argv[2]}/packages/clerk-cli/src/clerk-lifecycle-journal.mjs`);
await writeRegisterJournal({ journalPath: createJournalPath(process.argv[3]), name: "recovered-clerk", destination: process.argv[4] });
NODE
OUT=$("$ROOT/packages/clerk-cli/bin/clerk-register.sh" recovered-clerk "$TMP/does-not-exist")
[ "$OUT" = "recovered-clerk	$RECOVERED	active" ]
grep -Fq "| recovered-clerk | $CLERKMESH_CLERKS/recovered-clerk | active | false |" "$CLERKMESH_DATA/clerks.md"
[ ! -e "$CLERKMESH_STATE/clerk-lifecycle-journal.v1.json" ]

# A reused name fails without changing either source or authoritative registry.
cp "$CLERKMESH_DATA/clerks.md" "$TMP/before"
if "$ROOT/packages/clerk-cli/bin/clerk-register.sh" imported-clerk "$TMP/source" >"$TMP/out" 2>"$TMP/err"; then
  echo 'duplicate Clerk unexpectedly registered' >&2; exit 1
fi
[ ! -s "$TMP/out" ]; grep -q 'already used' "$TMP/err"; cmp "$TMP/before" "$CLERKMESH_DATA/clerks.md"
! find "$CLERKMESH_CLERKS" -maxdepth 1 -name '.imported-clerk.register.*' | grep -q .
printf '%s\n' 'ok - Clerk register imports approved history and recovers interrupted publication'
