#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/clerkmesh-restore.XXXXXX")
TMP=$(CDPATH= cd -- "$TMP" && pwd -P)
trap 'rm -rf "$TMP"' EXIT HUP INT TERM
export CLERKMESH_DATA="$TMP/data" CLERKMESH_STATE="$TMP/state" CLERKMESH_CLERKS="$TMP/clerks"
mkdir -p "$CLERKMESH_DATA" "$CLERKMESH_STATE" "$CLERKMESH_CLERKS/escalation" "$CLERKMESH_CLERKS/review-clerk"
cat >"$CLERKMESH_DATA/clerks.md" <<EOF
# Clerk registry v1

| name | path | status | built-in |
|---|---|---|---|
| escalation | $CLERKMESH_CLERKS/escalation | active | true |
| review-clerk | $CLERKMESH_CLERKS/review-clerk | archived | false |
EOF
chmod +x "$ROOT/packages/clerk-cli/bin/clerk-restore.sh"

OUT=$(cd / && "$ROOT/packages/clerk-cli/bin/clerk-restore.sh" review-clerk)
[ "$OUT" = "review-clerk	active" ]
grep -Fq "| review-clerk | $CLERKMESH_CLERKS/review-clerk | active | false |" "$CLERKMESH_DATA/clerks.md"
[ ! -e "$CLERKMESH_STATE/clerk-lifecycle.lock" ]

# Repeating restore is idempotent and leaves authoritative bytes unchanged.
cp "$CLERKMESH_DATA/clerks.md" "$TMP/before"
OUT=$("$ROOT/packages/clerk-cli/bin/clerk-restore.sh" review-clerk)
[ "$OUT" = "review-clerk	active" ]
cmp "$TMP/before" "$CLERKMESH_DATA/clerks.md"

# Restart recovery completes a restore whose intent was durable before registry publication.
perl -0pi -e 's/\| review-clerk \|([^\n]+)\| active \| false \|/| review-clerk |$1| archived | false |/' "$CLERKMESH_DATA/clerks.md"
node --input-type=module - "$ROOT" "$CLERKMESH_STATE" <<'NODE'
const { createJournalPath, writeRestoreJournal } = await import(`file://${process.argv[2]}/packages/clerk-cli/src/clerk-lifecycle-journal.mjs`);
await writeRestoreJournal({ journalPath: createJournalPath(process.argv[3]), name: "review-clerk" });
NODE
OUT=$($ROOT/packages/clerk-cli/bin/clerk-restore.sh review-clerk)
[ "$OUT" = "$(printf 'review-clerk\tactive')" ]
grep -Fq "| review-clerk | $CLERKMESH_CLERKS/review-clerk | active | false |" "$CLERKMESH_DATA/clerks.md"
[ ! -e "$CLERKMESH_STATE/clerk-lifecycle-journal.v1.json" ]

if "$ROOT/packages/clerk-cli/bin/clerk-restore.sh" absent >"$TMP/out" 2>"$TMP/err"; then
  echo "unregistered Clerk unexpectedly restored" >&2; exit 1
fi
[ ! -s "$TMP/out" ]
grep -q 'Clerk is not registered: absent' "$TMP/err"

mkdir "$CLERKMESH_STATE/clerk-lifecycle.lock"
printf '%s owner\n' "$$" >"$CLERKMESH_STATE/clerk-lifecycle.lock/owner"
if "$ROOT/packages/clerk-cli/bin/clerk-restore.sh" review-clerk >"$TMP/out" 2>"$TMP/err"; then
  echo "live lifecycle lock unexpectedly bypassed" >&2; exit 1
fi
[ ! -s "$TMP/out" ]
grep -q "lock is held by live PID $$" "$TMP/err"

printf '%s\n' 'ok - Clerk restore is locked, atomic, idempotent, and registry-bound'
